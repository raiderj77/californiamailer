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
