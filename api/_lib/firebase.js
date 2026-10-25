// Server-only credentials from this project's Vercel environment settings.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'dulinproperties';
const APP_NAME = 'dulinproperties-backup';

export function adminApp() {
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) {
    if (existing.options.projectId !== PROJECT_ID) throw new Error('Backup Firebase project mismatch');
    return existing;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const account = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  if (account.project_id !== PROJECT_ID) throw new Error('Backup requires a dulinproperties service account');
  return initializeApp({ credential: cert(account), projectId: PROJECT_ID }, APP_NAME);
}

export const db = () => getFirestore(adminApp());
