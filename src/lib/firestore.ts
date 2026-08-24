import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// Legacy collection interfaces still accept provider-specific timestamp values.
// New campaign/payment paths use explicit server types in campaignTypes.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

// Types
export interface Territory {
  id?: string;
  name: string;
  county: string;
  cities: string;
  households: number;
  avgIncome: number;
  status: 'active' | 'research' | 'inactive';
  notes: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// Territories
export async function addTerritory(territory: Omit<Territory, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'territories'), {
    ...territory,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getTerritories(userId: string) {
  const q = query(
    collection(db, 'territories'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Territory));
}

export async function updateTerritory(id: string, data: Partial<Territory>) {
  const docRef = doc(db, 'territories', id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTerritory(id: string) {
  await deleteDoc(doc(db, 'territories', id));
}
// Prospect Types
export interface Prospect {
  id?: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  territoryId: string;
  territoryName: string;
  status:
    | 'new'
    | 'researching'
    | 'ready_to_contact'
    | 'contacted'
    | 'follow_up_needed'
    | 'interested'
    | 'reservation_sent'
    | 'reserved'
    | 'awaiting_payment'
    | 'paid'
    | 'not_interested'
    | 'no_response'
    | 'poor_fit'
    | 'do_not_contact'
    | 'renewal_opportunity'
    // Legacy values remain readable until existing records are migrated.
    | 'proposal'
    | 'closed'
    | 'lost';
  notes: string;
  businessCategory?: string;
  website?: string;
  contactRole?: string;
  serviceArea?: string;
  mailingTerritoryFit?: string;
  currentAdvertisedOffer?: string;
  estimatedCustomerValue?: number;
  activeAdvertisingEvidence?: string;
  officialSource?: string;
  officialSourceCheckedAt?: string;
  leadSource?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  qualificationStatus?: 'verify' | 'qualified' | 'disqualified';
  qualificationReason?: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  contactAttempts?: number;
  campaignId?: string;
  offeredPlacement?: 'standard';
  quotedPrice?: number;
  categoryReservationStatus?: 'none' | 'interest' | 'hold' | 'sold' | 'released';
  paymentStatus?: 'none' | 'pending' | 'cleared' | 'failed' | 'refunded' | 'disputed';
  proofStatus?: string;
  renewalStatus?: string;
  renewalDate?: string;
  doNotContact?: boolean;
  suppressed?: boolean;
  suppressedAt?: any;
  suppressedBy?: string;
  suppressionSource?: string;
  normalizedBusinessName?: string;
  normalizedEmail?: string;
  normalizedWebsite?: string;
  normalizedPhone?: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// Prospects
const PROSPECT_MUTABLE_FIELDS = [
  'businessName',
  'businessCategory',
  'website',
  'contactName',
  'contactRole',
  'email',
  'phone',
  'address',
  'city',
  'serviceArea',
  'territoryId',
  'territoryName',
  'mailingTerritoryFit',
  'currentAdvertisedOffer',
  'estimatedCustomerValue',
  'activeAdvertisingEvidence',
  'officialSource',
  'officialSourceCheckedAt',
  'leadSource',
  'priority',
  'qualificationStatus',
  'qualificationReason',
  'status',
  'lastContactDate',
  'nextFollowUpDate',
  'contactAttempts',
  'notes',
  'campaignId',
  'offeredPlacement',
  'quotedPrice',
  'categoryReservationStatus',
  'paymentStatus',
  'proofStatus',
  'renewalStatus',
  'renewalDate',
  'doNotContact',
  'suppressed',
] as const satisfies readonly (keyof Prospect)[];

function prospectMutationPayload(data: Partial<Prospect>) {
  const payload: Record<string, unknown> = {};
  for (const field of PROSPECT_MUTABLE_FIELDS) {
    if (data[field] !== undefined) payload[field] = data[field];
  }
  return payload;
}

async function mutateProspect(
  body: Record<string, unknown>,
  idToken: string,
) {
  const response = await fetch('/api/admin/prospects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as { error?: unknown; id?: unknown };
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'Prospect mutation failed.');
  }
  if (typeof result.id !== 'string' || !result.id) {
    throw new Error('Prospect mutation returned an invalid record identifier.');
  }
  return result.id;
}

export async function addProspect(
  prospect: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>,
  idToken: string,
) {
  return mutateProspect({
    action: 'create',
    prospect: prospectMutationPayload(prospect),
  }, idToken);
}

export async function getProspects(userId: string) {
  const q = query(
    collection(db, 'prospects'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Prospect));
}

export async function updateProspect(id: string, data: Partial<Prospect>, idToken: string) {
  await mutateProspect({
    action: 'update',
    prospectId: id,
    changes: prospectMutationPayload(data),
  }, idToken);
}

export async function deleteProspect(id: string) {
  await deleteDoc(doc(db, 'prospects', id));
}
// Campaign Types
export interface Campaign {
  id?: string;
  name: string;
  type: 'eddm' | 'coop' | 'solo';
  territoryId: string;
  territoryName: string;
  mailDate: string;
  quantity: number;
  cost: number;
  status: 'planning' | 'scheduled' | 'mailed' | 'completed';
  notes: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// Campaigns
export async function addCampaign(campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'campaigns'), {
    ...campaign,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getCampaigns(userId: string) {
  const q = query(
    collection(db, 'campaigns'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Campaign));
}

export async function updateCampaign(id: string, data: Partial<Campaign>) {
  const docRef = doc(db, 'campaigns', id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteCampaign(id: string) {
  await deleteDoc(doc(db, 'campaigns', id));
}
// VA Task Types
export interface VATask {
  id?: string;
  title: string;
  description: string;
  assignee: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// VA Tasks
export async function addVATask(task: Omit<VATask, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'vatasks'), {
    ...task,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getVATasks(userId: string) {
  const q = query(
    collection(db, 'vatasks'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VATask));
}

export async function updateVATask(id: string, data: Partial<VATask>) {
  const docRef = doc(db, 'vatasks', id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteVATask(id: string) {
  await deleteDoc(doc(db, 'vatasks', id));
}
// Email Template Types
export interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  category: 'intro' | 'followup' | 'proposal' | 'other';
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// Email Templates
export async function addEmailTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'emailtemplates'), {
    ...template,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getEmailTemplates(userId: string) {
  const q = query(
    collection(db, 'emailtemplates'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as EmailTemplate));
}

export async function updateEmailTemplate(id: string, data: Partial<EmailTemplate>) {
  const docRef = doc(db, 'emailtemplates', id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteEmailTemplate(id: string) {
  await deleteDoc(doc(db, 'emailtemplates', id));
}
// Activity Log Types
export interface Activity {
  id?: string;
  prospectId: string;
  prospectName: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'proposal';
  description: string;
  outcome: string;
  followUpDate: string;
  userId: string;
  createdAt?: any;
}

// Activities
export async function addActivity(activity: Omit<Activity, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'activities'), {
    ...activity,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getActivities(userId: string, prospectId?: string) {
  let q;
  if (prospectId) {
    q = query(
      collection(db, 'activities'),
      where('userId', '==', userId),
      where('prospectId', '==', prospectId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'activities'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Activity));
}

export async function deleteActivity(id: string) {
  await deleteDoc(doc(db, 'activities', id));
}

// Reminder Types
export interface Reminder {
  id?: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  relatedTo: 'prospect' | 'campaign' | 'task' | 'other';
  relatedId: string;
  relatedName: string;
  completed: boolean;
  userId: string;
  createdAt?: any;
}

// Reminders
export async function addReminder(reminder: Omit<Reminder, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'reminders'), {
    ...reminder,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getReminders(userId: string) {
  const q = query(
    collection(db, 'reminders'),
    where('userId', '==', userId),
    orderBy('dueDate', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Reminder));
}

export async function updateReminder(id: string, data: Partial<Reminder>) {
  const docRef = doc(db, 'reminders', id);
  await updateDoc(docRef, data);
}

export async function deleteReminder(id: string) {
  await deleteDoc(doc(db, 'reminders', id));
}

// Invoice Types
export interface Invoice {
  id?: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  campaignId: string;
  campaignName: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  notes: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Invoices
export async function addInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'invoices'), {
    ...invoice,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getInvoices(userId: string) {
  const q = query(
    collection(db, 'invoices'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Invoice));
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  const docRef = doc(db, 'invoices', id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteInvoice(id: string) {
  await deleteDoc(doc(db, 'invoices', id));
}

// Client Portal Types
export interface Client {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  accessCode: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// Clients
export async function addClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'clients'), {
    ...client,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getClients(userId: string) {
  const q = query(
    collection(db, 'clients'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Client));
}

export async function updateClient(id: string, data: Partial<Client>) {
  const docRef = doc(db, 'clients', id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteClient(id: string) {
  await deleteDoc(doc(db, 'clients', id));
}

export async function getClientByAccessCode(accessCode: string) {
  const q = query(
    collection(db, 'clients'),
    where('accessCode', '==', accessCode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Client;
}

// Team Member Types
export interface TeamMember {
  id?: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'active';
  ownerId: string;
  createdAt?: any;
}

// Team Members
export async function addTeamMember(member: Omit<TeamMember, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'teammembers'), {
    ...member,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getTeamMembers(ownerId: string) {
  const q = query(
    collection(db, 'teammembers'),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TeamMember));
}

export async function updateTeamMember(id: string, data: Partial<TeamMember>) {
  const docRef = doc(db, 'teammembers', id);
  await updateDoc(docRef, data);
}

export async function deleteTeamMember(id: string) {
  await deleteDoc(doc(db, 'teammembers', id));
}


// ============ CO-OP SPOTS ============
export interface CoopSpot {
  id?: string;
  campaignId: string;
  campaignName: string;
  territory: string;
  city: string;
  spotNumber: number;
  totalSpots: number;
  category?: string;
  status: 'available' | 'reserved' | 'sold';
  price: number;
  mailDate: string;
  households: number;
  reservedBy?: string;
  reservedAt?: any;
  paidAt?: any;
  stripePaymentId?: string;
  createdAt?: any;
}

export async function getCoopSpots() {
  const snapshot = await getDocs(collection(db, 'coopspots'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoopSpot));
}

export async function getAvailableCoopSpots() {
  const q = query(collection(db, 'coopspots'), where('status', '==', 'available'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoopSpot));
}

export async function addCoopSpot(spot: Omit<CoopSpot, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'coopspots'), {
    ...spot,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCoopSpot(id: string, data: Partial<CoopSpot>) {
  const docRef = doc(db, 'coopspots', id);
  await updateDoc(docRef, data);
}

export async function deleteCoopSpot(id: string) {
  await deleteDoc(doc(db, 'coopspots', id));
}

// ============ OFFERS / COUPONS ============
export interface Offer {
  id?: string;
  code: string;
  businessName: string;
  businessLogo?: string;
  headline: string;
  description: string;
  discount: string;
  terms: string;
  expirationDate: string;
  phone?: string;
  website?: string;
  address?: string;
  campaignId: string;
  category: string;
  cta: string;
  backgroundColor: string;
  accentColor: string;
  redemptions: number;
  views: number;
  isActive: boolean;
  createdAt?: any;
}

export async function getOffers() {
  const snapshot = await getDocs(collection(db, 'offers'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
}

export async function getOfferByCode(code: string) {
  const q = query(collection(db, 'offers'), where('code', '==', code.toUpperCase()), where('isActive', '==', true));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Offer;
}

export async function addOffer(offer: Omit<Offer, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'offers'), {
    ...offer,
    code: offer.code.toUpperCase(),
    redemptions: 0,
    views: 0,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateOffer(id: string, data: Partial<Offer>) {
  const docRef = doc(db, 'offers', id);
  await updateDoc(docRef, data);
}

export async function incrementOfferViews(id: string) {
  const docRef = doc(db, 'offers', id);
  const snapshot = await getDocs(query(collection(db, 'offers'), where('__name__', '==', id)));
  if (!snapshot.empty) {
    const current = snapshot.docs[0].data();
    await updateDoc(docRef, { views: (current.views || 0) + 1 });
  }
}

export async function deleteOffer(id: string) {
  await deleteDoc(doc(db, 'offers', id));
}

// ============ REDEMPTIONS ============
export interface Redemption {
  id?: string;
  offerId: string;
  offerCode: string;
  businessName: string;
  redeemedAt?: any;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
}

export async function getRedemptions() {
  const q = query(collection(db, 'redemptions'), orderBy('redeemedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Redemption));
}

export async function addRedemption(redemption: Omit<Redemption, 'id' | 'redeemedAt'>) {
  const docRef = await addDoc(collection(db, 'redemptions'), {
    ...redemption,
    redeemedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ============ PROOFS ============
export interface Proof {
  id?: string;
  campaignId: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  version: number;
  fileUrl: string;
  thumbnailUrl?: string;
  status: 'pending' | 'approved' | 'revision-requested';
  feedback?: string;
  approvedAt?: any;
  approvedBy?: string;
  sentAt?: any;
  createdAt?: any;
}

export async function getProofs() {
  const q = query(collection(db, 'proofs'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Proof));
}

export async function getProof(id: string) {
  const snapshot = await getDocs(query(collection(db, 'proofs'), where('__name__', '==', id)));
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Proof;
}

export async function addProof(proof: Omit<Proof, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'proofs'), {
    ...proof,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateProof(id: string, data: Partial<Proof>) {
  const docRef = doc(db, 'proofs', id);
  await updateDoc(docRef, data);
}

export async function approveProof(id: string, approvedBy: string) {
  const docRef = doc(db, 'proofs', id);
  await updateDoc(docRef, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy,
  });
}

export async function requestProofRevision(id: string, feedback: string) {
  const docRef = doc(db, 'proofs', id);
  await updateDoc(docRef, {
    status: 'revision-requested',
    feedback,
  });
}

export async function deleteProof(id: string) {
  await deleteDoc(doc(db, 'proofs', id));
}

// ============ CAMPAIGN TRACKING ============
export interface CampaignTracking {
  id?: string;
  campaignId: string;
  status: 'design' | 'proof' | 'approved' | 'printing' | 'shipping' | 'delivered' | 'in-homes';
  statusHistory: { status: string; date: string; note?: string }[];
  trackingNumber?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  createdAt?: any;
  updatedAt?: any;
}

export async function getCampaignTracking(campaignId: string) {
  const q = query(collection(db, 'campaigntracking'), where('campaignId', '==', campaignId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as CampaignTracking;
}

export async function addCampaignTracking(tracking: Omit<CampaignTracking, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'campaigntracking'), {
    ...tracking,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCampaignTracking(id: string, data: Partial<CampaignTracking>) {
  const docRef = doc(db, 'campaigntracking', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ============ PAYMENTS ============
export interface Payment {
  id?: string;
  stripePaymentId: string;
  stripeCustomerId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  description: string;
  clientEmail: string;
  clientName?: string;
  coopSpotId?: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
  createdAt?: any;
}

export async function getPayments() {
  const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
}

export async function addPayment(payment: Omit<Payment, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, 'payments'), {
    ...payment,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePayment(id: string, data: Partial<Payment>) {
  const docRef = doc(db, 'payments', id);
  await updateDoc(docRef, data);
}

export async function getPaymentByStripeId(stripePaymentId: string) {
  const q = query(collection(db, 'payments'), where('stripePaymentId', '==', stripePaymentId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Payment;
}

// ============ HELPER: GET CAMPAIGN BY ID ============
export async function getCampaign(id: string) {
  const snapshot = await getDocs(query(collection(db, 'campaigns'), where('__name__', '==', id)));
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Campaign;
}

// ============ HELPER: GET CLIENTS (no userId filter) ============
export async function getAllClients() {
  const snapshot = await getDocs(collection(db, 'clients'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
}
