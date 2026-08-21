import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  CRM_ADDONS,
  CRM_AUTOMATION_POLICY,
  CRM_NEXT_ACTION_TYPES,
  DEFAULT_CRM_ADDON_STATE,
} from '@/config/crm';
import { buildCrmOpportunities, prospectStatusToCrmStage, safeProspectStatusForStage } from '@/lib/crmDomain';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { contactGate } from '@/lib/prospectRules';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const RECORD_LIMIT = 500;
const ACTIVITY_LIMIT = 1_000;
const documentId = z.string().trim().min(1).max(200).regex(/^[^/]+$/);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate, 'Invalid date.');
const mutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_stage'),
    prospectId: documentId,
    stage: z.enum(['qualification', 'ready', 'follow_up', 'interested', 'renewal', 'closed']),
  }).strict(),
  z.object({
    action: z.literal('schedule_next_action'),
    prospectId: documentId,
    actionType: z.enum(CRM_NEXT_ACTION_TYPES.map((item) => item.id) as [string, ...string[]]),
    dueDate: calendarDate,
    note: z.string().trim().max(300).default(''),
  }).strict(),
  z.object({
    action: z.literal('complete_next_action'),
    prospectId: documentId,
    outcome: z.string().trim().max(500).default(''),
  }).strict(),
  z.object({
    action: z.literal('add_note'),
    prospectId: documentId,
    note: z.string().trim().min(2).max(2_000),
  }).strict(),
  z.object({
    action: z.literal('set_addon'),
    addonId: z.enum(CRM_ADDONS.map((item) => item.id) as [string, ...string[]]),
    enabled: z.boolean(),
  }).strict(),
  z.object({
    action: z.literal('promote_quote'),
    inquiryId: documentId,
  }).strict(),
  z.object({
    action: z.literal('set_quote_status'),
    inquiryId: documentId,
    status: z.enum(['reviewed', 'dismissed']),
  }).strict(),
]);

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const db = getAdminFirestore();
    const [prospectSnapshot, activitySnapshot, interestSnapshot, quoteSnapshot, settingsSnapshot] = await Promise.all([
      db.collection('prospects').where('userId', '==', owner.uid).orderBy('createdAt', 'desc').limit(RECORD_LIMIT).get(),
      db.collection('activities').where('userId', '==', owner.uid).orderBy('createdAt', 'desc').limit(ACTIVITY_LIMIT).get(),
      db.collection('reservationinterests').orderBy('createdAt', 'desc').limit(RECORD_LIMIT).get(),
      db.collection('quoteinquiries').orderBy('createdAt', 'desc').limit(RECORD_LIMIT).get(),
      db.collection('crmsettings').doc(owner.uid).get(),
    ]);

    const prospects = prospectSnapshot.docs.map((doc) => prospectView(doc.id, doc.data()));
    const interests = interestSnapshot.docs.map((doc) => interestView(doc.id, doc.data()));
    const quoteInquiries = quoteSnapshot.docs.map((doc) => quoteView(doc.id, doc.data()));
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const opportunities = buildCrmOpportunities(prospects, interests, quoteInquiries, today);
    const activities = activitySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        prospectId: clean(data.prospectId),
        prospectName: clean(data.prospectName),
        type: clean(data.type) || 'note',
        description: clean(data.description),
        outcome: clean(data.outcome),
        followUpDate: clean(data.followUpDate),
        createdAt: timestampToIso(data.createdAt),
      };
    });
    const overrides = settingsSnapshot.data()?.addons;
    const addons = CRM_ADDONS.map((addon) => ({
      ...addon,
      enabled: typeof overrides?.[addon.id] === 'boolean'
        ? Boolean(overrides[addon.id])
        : DEFAULT_CRM_ADDON_STATE[addon.id],
      licenseCost: 'No separate CaliforniaMailer SaaS license',
    }));

    return NextResponse.json({
      opportunities,
      activities,
      addons,
      safeguards: CRM_AUTOMATION_POLICY,
      sourceCounts: {
        prospects: prospects.length,
        reservationInterests: interests.length,
        quoteInquiries: quoteInquiries.length,
      },
      limits: {
        recordsPerSource: RECORD_LIMIT,
        activities: ACTIVITY_LIMIT,
        possiblyTruncated: [prospectSnapshot.size, interestSnapshot.size, quoteSnapshot.size].some((size) => size === RECORD_LIMIT)
          || activitySnapshot.size === ACTIVITY_LIMIT,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, 'CRM workspace could not be read.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid CRM action.' }, { status: 400 });
    const db = getAdminFirestore();
    const input = parsed.data;

    if (input.action === 'set_addon') {
      const settingsRef = db.collection('crmsettings').doc(owner.uid);
      const batch = db.batch();
      batch.set(settingsRef, {
        addons: { [input.addonId]: input.enabled },
        updatedBy: owner.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'crm.addon_visibility',
        entityId: input.addonId,
        summary: `Owner ${input.enabled ? 'enabled' : 'disabled'} an internal CRM workspace module. No provider service was activated.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    if (input.action === 'promote_quote') {
      const inquiryRef = db.collection('quoteinquiries').doc(input.inquiryId);
      const prospectRef = db.collection('prospects').doc(`quote__${input.inquiryId}`);
      await db.runTransaction(async (transaction) => {
        const inquirySnapshot = await transaction.get(inquiryRef);
        const inquiry = inquirySnapshot.data();
        if (!inquiry) throw new CrmConflictError('Quote inquiry not found.', 404);
        if (['dismissed', 'do_not_contact'].includes(clean(inquiry.status))) {
          throw new CrmConflictError('A dismissed or suppressed inquiry cannot be promoted.', 409);
        }
        const normalizedEmail = clean(inquiry.email).toLowerCase();
        const [prospectSnapshot, matchingProspects] = await Promise.all([
          transaction.get(prospectRef),
          transaction.get(db.collection('prospects').where('normalizedEmail', '==', normalizedEmail).limit(10)),
        ]);
        if (inquiry.prospectId || prospectSnapshot.exists) throw new CrmConflictError('This quote inquiry was already promoted.', 409);
        if (matchingProspects.docs.some((doc) => doc.data().userId === owner.uid)) {
          throw new CrmConflictError('A prospect with this email already exists. Review the existing record instead of duplicating it.', 409);
        }
        transaction.create(prospectRef, quoteProspectRecord(inquiry, owner.uid, input.inquiryId));
        transaction.update(inquiryRef, {
          status: 'promoted',
          reviewQueueStatus: 'reviewed',
          prospectId: prospectRef.id,
          reviewedBy: owner.uid,
          reviewedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: owner.uid,
          action: 'crm.quote_promote',
          entityId: input.inquiryId,
          summary: 'Promoted a real quote inquiry to an unqualified researching prospect. No outreach occurred.',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true, prospectId: prospectRef.id });
    }

    if (input.action === 'set_quote_status') {
      const inquiryRef = db.collection('quoteinquiries').doc(input.inquiryId);
      await db.runTransaction(async (transaction) => {
        const inquirySnapshot = await transaction.get(inquiryRef);
        const inquiry = inquirySnapshot.data();
        if (!inquiry) throw new CrmConflictError('Quote inquiry not found.', 404);
        if (inquiry.prospectId || inquiry.status === 'promoted') {
          throw new CrmConflictError('This inquiry is already represented by a prospect.', 409);
        }
        if (inquiry.status === 'do_not_contact') {
          throw new CrmConflictError('A suppressed inquiry cannot be reopened from the CRM.', 409);
        }
        transaction.update(inquiryRef, {
          status: input.status,
          reviewQueueStatus: input.status === 'dismissed' ? 'dismissed' : 'reviewed',
          reviewedBy: owner.uid,
          reviewedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: owner.uid,
          action: `crm.quote_${input.status}`,
          entityId: input.inquiryId,
          summary: `Owner marked a quote inquiry ${input.status}. No outreach occurred.`,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true });
    }

    const prospectRef = db.collection('prospects').doc(input.prospectId);
    const prospectSnapshot = await prospectRef.get();
    const prospect = prospectSnapshot.data();
    if (!prospect || prospect.userId !== owner.uid) {
      return NextResponse.json({ error: 'Prospect record not found.' }, { status: 404 });
    }
    if (prospect.doNotContact === true || prospect.status === 'do_not_contact') {
      return NextResponse.json({ error: 'This prospect is suppressed. CRM mutations are blocked.' }, { status: 409 });
    }

    if (input.action === 'set_stage') {
      const currentStage = prospectStatusToCrmStage(clean(prospect.status));
      if (currentStage === 'reservation' || currentStage === 'paid') {
        return NextResponse.json({ error: 'Reservation and paid stages are controlled by their verified workflows.' }, { status: 409 });
      }
      const status = safeProspectStatusForStage(input.stage);
      if (!status) return NextResponse.json({ error: 'That stage is controlled by a verified reservation or payment event.' }, { status: 409 });
      if (input.stage === 'ready') {
        const gate = contactGate(prospect);
        if (!gate.allowed) {
          return NextResponse.json({ error: `Qualification is incomplete: ${gate.missing.join(', ')}.` }, { status: 409 });
        }
      }
      const batch = db.batch();
      batch.update(prospectRef, {
        status,
        crmStageUpdatedBy: owner.uid,
        crmStageUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.create(db.collection('activities').doc(), activityRecord(
        owner.uid,
        input.prospectId,
        clean(prospect.businessName),
        `CRM stage changed from ${clean(prospect.status) || 'unknown'} to ${status}.`,
        'Internal stage update only; no contact, reply, reservation, or payment was inferred.',
        clean(prospect.nextFollowUpDate),
      ));
      batch.create(db.collection('auditlog').doc(), auditRecord(owner.uid, 'crm.stage', input.prospectId, 'Owner changed a CRM stage on the source prospect record.'));
      await batch.commit();
      return NextResponse.json({ success: true, status });
    }

    if (input.action === 'schedule_next_action') {
      const batch = db.batch();
      batch.update(prospectRef, {
        nextFollowUpDate: input.dueDate,
        crmNextAction: input.actionType,
        crmNextActionNote: input.note,
        crmTaskUpdatedBy: owner.uid,
        crmTaskUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.create(db.collection('auditlog').doc(), auditRecord(owner.uid, 'crm.task_schedule', input.prospectId, 'Owner scheduled an internal next action. No outreach was sent.'));
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    if (input.action === 'complete_next_action') {
      const currentAction = clean(prospect.crmNextAction);
      const currentDate = clean(prospect.nextFollowUpDate);
      if (!currentAction && !currentDate) return NextResponse.json({ error: 'No scheduled next action exists.' }, { status: 409 });
      const label = CRM_NEXT_ACTION_TYPES.find((item) => item.id === currentAction)?.label || 'Owner task';
      const batch = db.batch();
      batch.update(prospectRef, {
        nextFollowUpDate: '',
        crmNextAction: '',
        crmNextActionNote: '',
        crmTaskCompletedBy: owner.uid,
        crmTaskCompletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.create(db.collection('activities').doc(), activityRecord(
        owner.uid,
        input.prospectId,
        clean(prospect.businessName),
        `Owner marked the CRM next action complete: ${label}.`,
        input.outcome || 'Completion was recorded internally; no delivery, response, or sale was inferred.',
        '',
      ));
      batch.create(db.collection('auditlog').doc(), auditRecord(owner.uid, 'crm.task_complete', input.prospectId, 'Owner completed an internal next action.'));
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    const batch = db.batch();
    batch.create(db.collection('activities').doc(), activityRecord(
      owner.uid,
      input.prospectId,
      clean(prospect.businessName),
      input.note,
      'Internal note only; no outreach, response, reservation, or payment was inferred.',
      clean(prospect.nextFollowUpDate),
    ));
    batch.update(prospectRef, { updatedAt: FieldValue.serverTimestamp() });
    batch.create(db.collection('auditlog').doc(), auditRecord(owner.uid, 'crm.note', input.prospectId, 'Owner added an internal CRM note.'));
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'CRM action failed.');
  }
}

function prospectView(id: string, data: DocumentData) {
  return {
    id,
    businessName: clean(data.businessName),
    contactName: clean(data.contactName),
    email: clean(data.email),
    phone: clean(data.phone),
    businessCategory: clean(data.businessCategory),
    status: clean(data.status),
    categoryReservationStatus: clean(data.categoryReservationStatus),
    paymentStatus: clean(data.paymentStatus),
    proofStatus: clean(data.proofStatus),
    qualificationStatus: clean(data.qualificationStatus),
    doNotContact: data.doNotContact === true,
    nextFollowUpDate: clean(data.nextFollowUpDate),
    crmNextAction: clean(data.crmNextAction),
    crmNextActionNote: clean(data.crmNextActionNote),
    campaignId: clean(data.campaignId),
    contactPreference: clean(data.contactPreference),
    replyPermission: clean(data.replyPermission),
    sourceQuoteInquiryId: clean(data.sourceQuoteInquiryId),
    sourceQuotePublicReference: clean(data.sourceQuotePublicReference),
    sourceQuoteMessage: clean(data.sourceQuoteMessage),
    sourceQuoteServiceType: clean(data.sourceQuoteServiceType),
    sourceQuoteCity: clean(data.sourceQuoteCity),
    sourceQuoteQuantity: typeof data.sourceQuoteQuantity === 'number' ? data.sourceQuoteQuantity : clean(data.sourceQuoteQuantity) || null,
    sourceQuoteSharedModelId: clean(data.sourceQuoteSharedModelId),
    sourceQuoteMailerSpecId: clean(data.sourceQuoteMailerSpecId),
    sourceQuoteMailerLabel: clean(data.sourceQuoteMailerLabel),
    sourceQuoteTargeting: clean(data.sourceQuoteTargeting),
    sourceQuoteFulfillment: clean(data.sourceQuoteFulfillment),
    sourceQuoteIntakeStatus: clean(data.sourceQuoteIntakeStatus),
    sourceQuoteReviewQueueStatus: clean(data.sourceQuoteReviewQueueStatus),
    sourceQuoteNotificationStatus: clean(data.sourceQuoteNotificationStatus),
    sourceQuoteOutboundMessageStatus: clean(data.sourceQuoteOutboundMessageStatus),
    sourceQuoteSubmittedAt: timestampToIso(data.sourceQuoteSubmittedAt),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function interestView(id: string, data: DocumentData) {
  return {
    id,
    publicReference: clean(data.publicReference),
    businessName: clean(data.businessName),
    contactName: clean(data.contactName),
    email: clean(data.email),
    phone: clean(data.phone),
    categorySlug: clean(data.categorySlug),
    status: clean(data.status),
    prospectId: clean(data.prospectId) || null,
    campaignId: clean(data.campaignId),
    createdAt: timestampToIso(data.createdAt),
  };
}

function quoteView(id: string, data: DocumentData) {
  return {
    id,
    business: clean(data.business),
    name: clean(data.name),
    email: clean(data.email),
    phone: clean(data.phone),
    category: clean(data.category),
    serviceType: clean(data.serviceType),
    status: clean(data.status),
    prospectId: clean(data.prospectId) || null,
    city: clean(data.city),
    message: clean(data.message),
    contactPreference: clean(data.contactPreference),
    replyPermission: clean(data.replyPermission),
    publicReference: clean(data.publicReference),
    intakeStatus: clean(data.intakeStatus),
    reviewQueueStatus: clean(data.reviewQueueStatus),
    notificationStatus: clean(data.notificationStatus),
    outboundMessageStatus: clean(data.outboundMessageStatus),
    quantity: typeof data.quantity === 'number' ? data.quantity : clean(data.quantity) || null,
    sharedModelId: clean(data.sharedModelId),
    mailerSpecId: clean(data.mailerSpecId),
    mailerLabel: clean(data.mailerLabel),
    targeting: clean(data.targeting),
    fulfillment: clean(data.fulfillment),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function quoteProspectRecord(inquiry: DocumentData, ownerUid: string, inquiryId: string) {
  const businessName = clean(inquiry.business);
  const email = clean(inquiry.email);
  const phone = clean(inquiry.phone);
  return {
    businessName,
    businessCategory: clean(inquiry.category),
    website: '',
    contactName: clean(inquiry.name),
    contactRole: '',
    email,
    phone,
    address: '',
    city: clean(inquiry.city),
    serviceArea: '',
    territoryId: '',
    territoryName: '',
    mailingTerritoryFit: '',
    currentAdvertisedOffer: '',
    activeAdvertisingEvidence: '',
    officialSource: '',
    officialSourceCheckedAt: '',
    leadSource: 'public_quote_form',
    contactPreference: clean(inquiry.contactPreference),
    replyPermission: clean(inquiry.replyPermission) || 'requested_quote_response_only',
    sourceQuoteInquiryId: inquiryId,
    sourceQuotePublicReference: clean(inquiry.publicReference),
    sourceQuoteMessage: clean(inquiry.message),
    sourceQuoteServiceType: clean(inquiry.serviceType),
    sourceQuoteCity: clean(inquiry.city),
    sourceQuoteQuantity: typeof inquiry.quantity === 'number' ? inquiry.quantity : clean(inquiry.quantity) || null,
    sourceQuoteSharedModelId: clean(inquiry.sharedModelId),
    sourceQuoteMailerSpecId: clean(inquiry.mailerSpecId),
    sourceQuoteMailerLabel: clean(inquiry.mailerLabel),
    sourceQuoteTargeting: clean(inquiry.targeting),
    sourceQuoteFulfillment: clean(inquiry.fulfillment),
    sourceQuoteIntakeStatus: clean(inquiry.intakeStatus),
    sourceQuoteReviewQueueStatus: 'reviewed',
    sourceQuoteNotificationStatus: clean(inquiry.notificationStatus),
    sourceQuoteOutboundMessageStatus: clean(inquiry.outboundMessageStatus),
    sourceQuoteSubmittedAt: inquiry.createdAt ?? null,
    sourceQuoteSnapshotVersion: 2,
    priority: 'high',
    qualificationStatus: 'verify',
    qualificationReason: 'Promoted from a real quote inquiry; public-source qualification still required.',
    status: 'researching',
    lastContactDate: '',
    nextFollowUpDate: '',
    crmNextAction: 'research',
    crmNextActionNote: 'Verify the business and scope before any manual reply.',
    contactAttempts: 0,
    campaignId: '',
    offeredPlacement: 'standard',
    categoryReservationStatus: 'none',
    paymentStatus: 'none',
    proofStatus: 'not_started',
    renewalStatus: 'none',
    renewalDate: '',
    doNotContact: false,
    notes: `Quote inquiry ${inquiryId}; response permission is limited to the requested quote. Contact preference: ${clean(inquiry.contactPreference) || 'not recorded'}. No qualification or sale inferred.`,
    normalizedBusinessName: businessName.toLowerCase(),
    normalizedEmail: email.toLowerCase(),
    normalizedWebsite: '',
    normalizedPhone: phone.replace(/\D/g, '').slice(-10),
    userId: ownerUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function activityRecord(ownerUid: string, prospectId: string, prospectName: string, description: string, outcome: string, followUpDate: string) {
  return {
    prospectId,
    prospectName,
    type: 'note',
    description,
    outcome,
    followUpDate,
    userId: ownerUid,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function auditRecord(actorUid: string, action: string, entityId: string, summary: string) {
  return { actorUid, action, entityId, summary, createdAt: FieldValue.serverTimestamp() };
}

function timestampToIso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof CrmConflictError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

class CrmConflictError extends Error {
  constructor(message: string, public readonly status: 404 | 409) {
    super(message);
  }
}
