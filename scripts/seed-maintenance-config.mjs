import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

function getProjectId() {
  if (process.env.FIREBASE_PROJECT_ID?.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }

  if (process.env.VITE_FIREBASE_PROJECT_ID?.trim()) {
    return process.env.VITE_FIREBASE_PROJECT_ID.trim();
  }

  const firebasercPath = path.join(workspaceRoot, '.firebaserc');
  if (!fs.existsSync(firebasercPath)) {
    return null;
  }

  try {
    const contents = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
    const defaultProject = contents?.projects?.default;
    return typeof defaultProject === 'string' && defaultProject.trim() ? defaultProject.trim() : null;
  } catch {
    return null;
  }
}

function getAdminApp() {
  const existing = getApps().find((app) => app.name === 'maintenance-seed');
  if (existing) {
    return existing;
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID, VITE_FIREBASE_PROJECT_ID, or .firebaserc default project.');
  }

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId }, 'maintenance-seed');
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    return initializeApp(
      {
        credential: cert(JSON.parse(serviceAccountJson)),
        projectId,
      },
      'maintenance-seed',
    );
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    return initializeApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      },
      'maintenance-seed',
    );
  }

  return initializeApp(
    {
      credential: applicationDefault(),
      projectId,
    },
    'maintenance-seed',
  );
}

async function main() {
  const app = getAdminApp();
  const db = getFirestore(app);
  const maintenanceRef = db.doc('config/maintenance');
  const existing = await maintenanceRef.get();

  if (existing.exists) {
    console.log('Firestore document config/maintenance already exists');
    return;
  }

  await maintenanceRef.set({
    date: '',
    isMaintenanceMode: false,
    lastUpdatedAt: FieldValue.serverTimestamp(),
    subtitle: 'We are making improvements. Please check back shortly.',
    title: 'Down for Maintenance',
  }, { merge: true });

  console.log('Seeded Firestore document config/maintenance');
}

main().catch((error) => {
  console.error('Failed to seed config/maintenance');
  console.error(error);
  process.exitCode = 1;
});