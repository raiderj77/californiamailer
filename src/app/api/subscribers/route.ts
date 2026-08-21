import { createHash, randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { consumeRateLimit, requestFingerprint } from '@/lib/rateLimit';

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request_signup'), email: z.string().trim().email().max(254), consent: z.literal(true), source: z.literal('monterey_deals_page'), website: z.string().max(0).optional().default('') }).strict(),
  z.object({ action: z.literal('request_unsubscribe'), email: z.string().trim().email().max(254), website: z.string().max(0).optional().default('') }).strict(),
]);
const confirmSchema = z.object({ action: z.enum(['confirm_signup', 'confirm_unsubscribe']), email: z.string().trim().email().max(254), code: z.string().regex(/^\d{6}$/) }).strict();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const enabled = () => process.env.CONSUMER_EMAIL_ENABLED === 'true' && Boolean(process.env.BUSINESS_POSTAL_ADDRESS);

export async function POST(request: NextRequest) {
  const rate = consumeRateLimit(requestFingerprint(request, 'subscriber-request'), 5, 60 * 60_000); if (!rate.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  if (!enabled()) return NextResponse.json({ error: 'The optional local-deals list is not active.' }, { status: 503 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Review the email request.' }, { status: 400 }); if (parsed.data.website) return NextResponse.json({ success: true });
  const email = parsed.data.email.toLowerCase(); const id = hash(email); const db = getAdminFirestore(); const subscriberRef = db.collection('subscribers').doc(id); const suppressionRef = db.collection('suppressions').doc(id); const code = String(randomInt(0, 1_000_000)).padStart(6, '0'); const expiresAt = Timestamp.fromMillis(Date.now() + 15 * 60_000);
  if (parsed.data.action === 'request_signup') {
    if ((await suppressionRef.get()).exists) return NextResponse.json({ error: 'This address is suppressed. Contact the owner to document a new consent request.' }, { status: 409 });
    const existing = await subscriberRef.get();
    if (existing.data()?.status === 'subscribed') return NextResponse.json({ success: true, message: 'This address is already verified for the local-deals list.' });
    await subscriberRef.set({ email, status: 'pending_verification', signupSource: parsed.data.source, consentTextVersion: 'monterey-deals-2026-08', consentRequestedAt: FieldValue.serverTimestamp(), verificationCodeHash: hash(`${id}:${code}`), verificationExpiresAt: expiresAt, frequency: 'no_more_than_twice_monthly', advertisersReceiveDatabase: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    const snapshot = await subscriberRef.get(); if (!snapshot.exists) return NextResponse.json({ success: true, message: 'If the address is subscribed, a confirmation code will be sent.' });
    await subscriberRef.update({ unsubscribeCodeHash: hash(`${id}:${code}`), unsubscribeExpiresAt: expiresAt, updatedAt: FieldValue.serverTimestamp() });
  }
  const purpose = parsed.data.action === 'request_signup' ? 'confirm your Monterey Peninsula deals signup' : 'confirm unsubscribe'; const result = await sendEmail({ to: email, subject: `CaliforniaMailer code: ${code}`, text: [`Use code ${code} to ${purpose}.`, 'The code expires in 15 minutes.', '', 'Expected frequency after verified signup: no more than two local-deals emails per month.', 'CaliforniaMailer does not give the subscriber database to advertisers.', '', `Sender postal address: ${process.env.BUSINESS_POSTAL_ADDRESS}`].join('\n') });
  if (!result.success) {
    await subscriberRef.set(parsed.data.action === 'request_signup'
      ? { status: 'verification_delivery_failed', updatedAt: FieldValue.serverTimestamp() }
      : { unsubscribeDeliveryFailedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ error: 'The verification message could not be delivered.' }, { status: 502 });
  }
  return NextResponse.json({ success: true, message: 'Check your email for a six-digit code.' });
}

export async function PATCH(request: NextRequest) {
  const rate = consumeRateLimit(requestFingerprint(request, 'subscriber-confirm'), 10, 60 * 60_000); if (!rate.allowed) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  if (!enabled()) return NextResponse.json({ error: 'The optional local-deals list is not active.' }, { status: 503 });
  const parsed = confirmSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Enter the six-digit code.' }, { status: 400 });
  const email = parsed.data.email.toLowerCase(); const id = hash(email); const db = getAdminFirestore(); const subscriberRef = db.collection('subscribers').doc(id); const suppressionRef = db.collection('suppressions').doc(id);
  try {
    await db.runTransaction(async (transaction) => {
      const [snapshot, suppression] = await Promise.all([transaction.get(subscriberRef), transaction.get(suppressionRef)]); const data = snapshot.data(); if (!data) throw new Error('invalid-code'); const now = Date.now();
      if (parsed.data.action === 'confirm_signup') {
        if (suppression.exists) throw new Error('suppressed');
        if (data.verificationExpiresAt?.toMillis?.() < now || data.verificationCodeHash !== hash(`${id}:${parsed.data.code}`)) throw new Error('invalid-code');
        transaction.update(subscriberRef, { status: 'subscribed', verifiedAt: FieldValue.serverTimestamp(), verificationCodeHash: null, verificationExpiresAt: null, updatedAt: FieldValue.serverTimestamp() });
        transaction.create(db.collection('consentrecords').doc(), { subscriberId: id, email, action: 'affirmative_signup_verified', source: data.signupSource, consentTextVersion: data.consentTextVersion, frequency: data.frequency, createdAt: FieldValue.serverTimestamp() });
      } else {
        if (data.unsubscribeExpiresAt?.toMillis?.() < now || data.unsubscribeCodeHash !== hash(`${id}:${parsed.data.code}`)) throw new Error('invalid-code');
        transaction.update(subscriberRef, { status: 'unsubscribed', unsubscribedAt: FieldValue.serverTimestamp(), verificationCodeHash: null, verificationExpiresAt: null, unsubscribeCodeHash: null, unsubscribeExpiresAt: null, updatedAt: FieldValue.serverTimestamp() });
        transaction.set(suppressionRef, { email, reason: 'consumer_unsubscribe', source: 'self_service_code_confirmation', createdAt: FieldValue.serverTimestamp() });
        transaction.create(db.collection('consentrecords').doc(), { subscriberId: id, email, action: 'unsubscribe_confirmed', createdAt: FieldValue.serverTimestamp() });
      }
    });
    return NextResponse.json({ success: true, status: parsed.data.action === 'confirm_signup' ? 'subscribed' : 'unsubscribed' });
  } catch { return NextResponse.json({ error: 'The code is invalid or expired.' }, { status: 400 }); }
}
