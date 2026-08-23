import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

interface ServiceAccountShape {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
}

function parseServiceAccount(): ServiceAccountShape | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const decoded = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded) as ServiceAccountShape;
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    };
  }

  return null;
}

function initializeAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const account = parseServiceAccount();
  if (account) {
    const projectId = account.project_id ?? account.projectId;
    const clientEmail = account.client_email ?? account.clientEmail;
    const privateKey = (account.private_key ?? account.privateKey)?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase service-account configuration is incomplete.');
    }
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId, storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault() });
  }

  throw new Error('Firebase Admin credentials are not configured.');
}

export function getAdminFirestore() {
  return getFirestore(initializeAdminApp());
}

export function getAdminAuth() {
  return getAuth(initializeAdminApp());
}

export function getAdminStorage() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('Firebase Storage is not configured.');
  return getStorage(initializeAdminApp()).bucket(bucketName);
}
