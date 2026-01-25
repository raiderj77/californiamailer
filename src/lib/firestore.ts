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
  status: 'new' | 'contacted' | 'interested' | 'proposal' | 'closed' | 'lost';
  notes: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// Prospects
export async function addProspect(prospect: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'prospects'), {
    ...prospect,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
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

export async function updateProspect(id: string, data: Partial<Prospect>) {
  const docRef = doc(db, 'prospects', id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
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
