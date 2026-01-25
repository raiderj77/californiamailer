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
