import {
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AppSettings } from './appSettings';
import { getUserDocumentRef } from './userPaths';

const ref = (uid: string) => getUserDocumentRef(db, uid);

/**
 * Create a Firestore profile doc on first sign-up.
 * Safe to call on every login — skips if doc already exists.
 */
export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL?: string,
): Promise<void> {
  const snap = await getDoc(ref(uid));
  if (snap.exists()) return;

  await setDoc(ref(uid), {
    uid,
    email,
    displayName,
    ...(photoURL ? { photoURL } : {}),
    createdAt: serverTimestamp(),
    preferences: {
      defaultDuration: 10,
      defaultPreset: 'explainer',
      defaultProvider: 'gemini',
    },
    quota: {
      ideasThisMonth: 0,
      draftsThisMonth: 0,
      resetAt: serverTimestamp(),
    },
  });
}

/**
 * Update the photoURL field of a user's Firestore profile.
 * Call this after uploading a new avatar to Storage.
 */
export async function updateUserPhotoURL(uid: string, photoURL: string): Promise<void> {
  await updateDoc(ref(uid), { photoURL });
}

export async function getUserAppSettings(uid: string): Promise<AppSettings | null> {
  const snap = await getDoc(ref(uid));
  if (!snap.exists()) {
    return null;
  }

  return (snap.data().appSettings as AppSettings | undefined) ?? null;
}

export async function saveUserAppSettings(uid: string, settings: AppSettings): Promise<void> {
  await setDoc(ref(uid), { appSettings: settings }, { merge: true });
}

