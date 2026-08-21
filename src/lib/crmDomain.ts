import type { CrmNextActionType, CrmStageId } from '@/config/crm';
import { isLegacyOperationalProspectStatus } from '@/lib/prospectRules';

export type CrmOpportunitySource = 'prospect' | 'reservation_interest' | 'quote_inquiry';
export type CrmTaskState = 'unscheduled' | 'overdue' | 'today' | 'upcoming';
export type CrmOperationalStateSource = 'server_reservation_workflow' | 'legacy_prospect_note' | 'not_applicable';

export interface CrmProspectInput {
  id: string;
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  businessCategory?: string;
  status?: string;
  categoryReservationStatus?: string;
  paymentStatus?: string;
  proofStatus?: string;
  qualificationStatus?: string;
  doNotContact?: boolean;
  nextFollowUpDate?: string;
  crmNextAction?: string;
  crmNextActionNote?: string;
  campaignId?: string;
  contactPreference?: string;
  replyPermission?: string;
  sourceQuoteInquiryId?: string;
  sourceQuotePublicReference?: string;
  sourceQuoteMessage?: string;
  sourceQuoteServiceType?: string;
  sourceQuoteCity?: string;
  sourceQuoteQuantity?: number | string | null;
  sourceQuoteSharedModelId?: string;
  sourceQuoteMailerSpecId?: string;
  sourceQuoteMailerLabel?: string;
  sourceQuoteTargeting?: string;
  sourceQuoteFulfillment?: string;
  sourceQuoteIntakeStatus?: string;
  sourceQuoteReviewQueueStatus?: string;
  sourceQuoteNotificationStatus?: string;
  sourceQuoteOutboundMessageStatus?: string;
  sourceQuoteSubmittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CrmInterestInput {
  id: string;
  publicReference?: string;
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  categorySlug?: string;
  status?: string;
  prospectId?: string | null;
  campaignId?: string;
  createdAt?: string | null;
}

export interface CrmQuoteInquiryInput {
  id: string;
  business?: string;
  name?: string;
  email?: string;
  phone?: string;
  category?: string;
  serviceType?: string;
  status?: string;
  prospectId?: string | null;
  city?: string;
  message?: string;
  contactPreference?: string;
  replyPermission?: string;
  publicReference?: string;
  intakeStatus?: string;
  reviewQueueStatus?: string;
  notificationStatus?: string;
  outboundMessageStatus?: string;
  quantity?: number | string | null;
  sharedModelId?: string;
  mailerSpecId?: string;
  mailerLabel?: string;
  targeting?: string;
  fulfillment?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CrmOpportunity {
  id: string;
  recordId: string;
  source: CrmOpportunitySource;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  stage: CrmStageId;
  sourceStatus: string;
  campaignId: string;
  qualificationStatus: string;
  categoryReservationStatus: string;
  paymentStatus: string;
  proofStatus: string;
  operationalStateSource: CrmOperationalStateSource;
  doNotContact: boolean;
  nextActionDate: string;
  nextActionType: CrmNextActionType | '';
  nextActionNote: string;
  taskState: CrmTaskState;
  publicReference: string;
  summary: string;
  contactPreference: string;
  replyPermission: string;
  serviceType: string;
  location: string;
  quantity: string;
  sharedModelId: string;
  mailerSpecId: string;
  mailerLabel: string;
  targeting: string;
  fulfillment: string;
  intakeStatus: string;
  reviewQueueStatus: string;
  notificationStatus: string;
  outboundMessageStatus: string;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  searchText: string;
}

const nextActionIds = new Set<CrmNextActionType>([
  'research',
  'write_email',
  'review_reply',
  'prepare_offer',
  'review_interest',
  'verify_payment',
  'request_materials',
  'review_proof',
  'renewal',
  'other',
]);

export function prospectStatusToCrmStage(status = ''): CrmStageId {
  // Prospect status and payment/category fields are legacy, owner-entered CRM
  // notes. They must never manufacture a payment-backed or reserved stage.
  if (isLegacyOperationalProspectStatus(status)) return 'interested';
  if (status === 'renewal_opportunity') return 'renewal';
  if (status === 'interested' || status === 'proposal') return 'interested';
  if (['contacted', 'follow_up_needed', 'no_response'].includes(status)) return 'follow_up';
  if (status === 'ready_to_contact') return 'ready';
  if (['new'].includes(status)) return 'inbound';
  if (['not_interested', 'poor_fit', 'do_not_contact', 'lost', 'closed'].includes(status)) return 'closed';
  return 'qualification';
}

export function interestStatusToCrmStage(status = ''): CrmStageId {
  if (['dismissed', 'do_not_contact'].includes(status)) return 'closed';
  // `invited` is written only by the owner-authorized reservation workflow.
  if (status === 'invited') return 'reservation';
  if (status === 'promoted') return 'qualification';
  return 'inbound';
}

export function safeProspectStatusForStage(stage: CrmStageId): string | null {
  const mapping: Partial<Record<CrmStageId, string>> = {
    qualification: 'researching',
    ready: 'ready_to_contact',
    follow_up: 'follow_up_needed',
    interested: 'interested',
    renewal: 'renewal_opportunity',
    closed: 'not_interested',
  };
  return mapping[stage] ?? null;
}

export function crmTaskState(date: string | undefined, today: string): CrmTaskState {
  if (!date) return 'unscheduled';
  if (date < today) return 'overdue';
  if (date === today) return 'today';
  return 'upcoming';
}

export function isCrmNextActionType(value: string | undefined): value is CrmNextActionType {
  return Boolean(value && nextActionIds.has(value as CrmNextActionType));
}

export function buildCrmOpportunities(
  prospects: CrmProspectInput[],
  interests: CrmInterestInput[],
  quoteInquiries: CrmQuoteInquiryInput[],
  today: string,
): CrmOpportunity[] {
  const prospectIds = new Set(prospects.map((prospect) => prospect.id));
  const prospectOpportunities = prospects.map((prospect): CrmOpportunity => {
    const businessName = clean(prospect.businessName) || 'Unnamed prospect';
    const nextActionType = isCrmNextActionType(prospect.crmNextAction) ? prospect.crmNextAction : '';
    const categoryReservationStatus = clean(prospect.categoryReservationStatus) || 'none';
    const paymentStatus = clean(prospect.paymentStatus) || 'none';
    const hasLegacyOperationalNote = isLegacyOperationalProspectStatus(prospect.status)
      || categoryReservationStatus !== 'none'
      || paymentStatus !== 'none';
    return {
      id: `prospect:${prospect.id}`,
      recordId: prospect.id,
      source: 'prospect',
      businessName,
      contactName: clean(prospect.contactName),
      email: clean(prospect.email),
      phone: clean(prospect.phone),
      category: clean(prospect.businessCategory),
      stage: prospectStatusToCrmStage(prospect.status),
      sourceStatus: clean(prospect.status) || 'unknown',
      campaignId: clean(prospect.campaignId),
      qualificationStatus: clean(prospect.qualificationStatus) || 'unknown',
      categoryReservationStatus,
      paymentStatus,
      proofStatus: clean(prospect.proofStatus) || 'unknown',
      operationalStateSource: hasLegacyOperationalNote ? 'legacy_prospect_note' : 'not_applicable',
      doNotContact: prospect.doNotContact === true || prospect.status === 'do_not_contact',
      nextActionDate: clean(prospect.nextFollowUpDate),
      nextActionType,
      nextActionNote: clean(prospect.crmNextActionNote),
      taskState: crmTaskState(prospect.nextFollowUpDate, today),
      publicReference: clean(prospect.sourceQuotePublicReference),
      summary: clean(prospect.sourceQuoteMessage),
      contactPreference: clean(prospect.contactPreference),
      replyPermission: clean(prospect.replyPermission),
      serviceType: clean(prospect.sourceQuoteServiceType),
      location: clean(prospect.sourceQuoteCity),
      quantity: stringify(prospect.sourceQuoteQuantity),
      sharedModelId: clean(prospect.sourceQuoteSharedModelId),
      mailerSpecId: clean(prospect.sourceQuoteMailerSpecId),
      mailerLabel: clean(prospect.sourceQuoteMailerLabel) || clean(prospect.sourceQuoteSharedModelId) || clean(prospect.sourceQuoteMailerSpecId),
      targeting: clean(prospect.sourceQuoteTargeting),
      fulfillment: clean(prospect.sourceQuoteFulfillment),
      intakeStatus: clean(prospect.sourceQuoteIntakeStatus),
      reviewQueueStatus: clean(prospect.sourceQuoteReviewQueueStatus),
      notificationStatus: clean(prospect.sourceQuoteNotificationStatus),
      outboundMessageStatus: clean(prospect.sourceQuoteOutboundMessageStatus),
      submittedAt: prospect.sourceQuoteSubmittedAt || null,
      createdAt: prospect.createdAt || null,
      updatedAt: prospect.updatedAt || null,
      searchText: searchText([businessName, prospect.contactName, prospect.email, prospect.phone, prospect.businessCategory, prospect.contactPreference, prospect.status, prospect.categoryReservationStatus, prospect.paymentStatus, prospect.sourceQuotePublicReference, prospect.sourceQuoteMessage, prospect.sourceQuoteServiceType, prospect.sourceQuoteCity, prospect.sourceQuoteSharedModelId, prospect.sourceQuoteMailerSpecId, prospect.sourceQuoteMailerLabel, prospect.sourceQuoteIntakeStatus, prospect.sourceQuoteReviewQueueStatus, prospect.sourceQuoteNotificationStatus, prospect.sourceQuoteOutboundMessageStatus]),
    };
  });

  const interestOpportunities = interests
    .filter((interest) => !interest.prospectId || !prospectIds.has(interest.prospectId))
    .map((interest): CrmOpportunity => {
      const businessName = clean(interest.businessName) || 'Unnamed inbound interest';
      return {
        id: `interest:${interest.id}`,
        recordId: interest.id,
        source: 'reservation_interest',
        businessName,
        contactName: clean(interest.contactName),
        email: clean(interest.email),
        phone: clean(interest.phone),
        category: clean(interest.categorySlug),
        stage: interestStatusToCrmStage(interest.status),
        sourceStatus: clean(interest.status) || 'received',
        campaignId: clean(interest.campaignId),
        qualificationStatus: 'not_promoted',
        categoryReservationStatus: 'not_applicable',
        paymentStatus: 'not_applicable',
        proofStatus: 'not_applicable',
        operationalStateSource: interest.status === 'invited' ? 'server_reservation_workflow' : 'not_applicable',
        doNotContact: interest.status === 'do_not_contact',
        nextActionDate: '',
        nextActionType: '',
        nextActionNote: '',
        taskState: 'unscheduled',
        publicReference: clean(interest.publicReference),
        summary: '',
        contactPreference: '',
        replyPermission: '',
        serviceType: '',
        location: '',
        quantity: '',
        sharedModelId: '',
        mailerSpecId: '',
        mailerLabel: '',
        targeting: '',
        fulfillment: '',
        intakeStatus: '',
        reviewQueueStatus: '',
        notificationStatus: '',
        outboundMessageStatus: '',
        submittedAt: null,
        createdAt: interest.createdAt || null,
        updatedAt: null,
        searchText: searchText([businessName, interest.contactName, interest.email, interest.phone, interest.categorySlug, interest.publicReference, interest.status]),
      };
    });

  const quoteOpportunities = quoteInquiries
    .filter((inquiry) => !inquiry.prospectId)
    .map((inquiry): CrmOpportunity => {
      const businessName = clean(inquiry.business) || 'Unnamed quote inquiry';
      const closed = ['dismissed', 'do_not_contact'].includes(clean(inquiry.status));
      return {
        id: `quote:${inquiry.id}`,
        recordId: inquiry.id,
        source: 'quote_inquiry',
        businessName,
        contactName: clean(inquiry.name),
        email: clean(inquiry.email),
        phone: clean(inquiry.phone),
        category: clean(inquiry.category),
        stage: closed ? 'closed' : 'inbound',
        sourceStatus: clean(inquiry.status) || 'new',
        campaignId: '',
        qualificationStatus: 'not_promoted',
        categoryReservationStatus: 'not_applicable',
        paymentStatus: 'not_applicable',
        proofStatus: 'not_applicable',
        operationalStateSource: 'not_applicable',
        doNotContact: inquiry.status === 'do_not_contact',
        nextActionDate: '',
        nextActionType: '',
        nextActionNote: '',
        taskState: 'unscheduled',
        publicReference: clean(inquiry.publicReference) || inquiry.id,
        summary: clean(inquiry.message),
        contactPreference: clean(inquiry.contactPreference),
        replyPermission: clean(inquiry.replyPermission),
        serviceType: clean(inquiry.serviceType),
        location: clean(inquiry.city),
        quantity: stringify(inquiry.quantity),
        sharedModelId: clean(inquiry.sharedModelId),
        mailerSpecId: clean(inquiry.mailerSpecId),
        mailerLabel: clean(inquiry.mailerLabel) || clean(inquiry.sharedModelId) || clean(inquiry.mailerSpecId),
        targeting: clean(inquiry.targeting),
        fulfillment: clean(inquiry.fulfillment),
        intakeStatus: clean(inquiry.intakeStatus) || 'unknown',
        reviewQueueStatus: clean(inquiry.reviewQueueStatus) || 'unknown',
        notificationStatus: clean(inquiry.notificationStatus) || 'unknown',
        outboundMessageStatus: clean(inquiry.outboundMessageStatus) || 'unknown',
        submittedAt: inquiry.createdAt || null,
        createdAt: inquiry.createdAt || null,
        updatedAt: inquiry.updatedAt || null,
        searchText: searchText([businessName, inquiry.name, inquiry.email, inquiry.phone, inquiry.category, inquiry.serviceType, inquiry.city, inquiry.message, inquiry.contactPreference, inquiry.publicReference, inquiry.status, inquiry.sharedModelId, inquiry.mailerSpecId, inquiry.mailerLabel, inquiry.intakeStatus, inquiry.reviewQueueStatus, inquiry.notificationStatus, inquiry.outboundMessageStatus]),
      };
    });

  return [...prospectOpportunities, ...interestOpportunities, ...quoteOpportunities].sort(compareOpportunity);
}

function compareOpportunity(a: CrmOpportunity, b: CrmOpportunity) {
  const taskRank: Record<CrmTaskState, number> = { overdue: 0, today: 1, upcoming: 2, unscheduled: 3 };
  const byTask = taskRank[a.taskState] - taskRank[b.taskState];
  if (byTask !== 0) return byTask;
  const byDate = (a.nextActionDate || '9999-12-31').localeCompare(b.nextActionDate || '9999-12-31');
  return byDate !== 0 ? byDate : a.businessName.localeCompare(b.businessName);
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function searchText(values: unknown[]) {
  return values.map(clean).filter(Boolean).join(' ').toLowerCase();
}

function stringify(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : clean(value);
}
