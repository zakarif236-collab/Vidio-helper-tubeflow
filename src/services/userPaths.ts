import { collection, doc, type CollectionReference, type DocumentReference, type Firestore } from 'firebase/firestore';
import { ref, type FirebaseStorage, type StorageReference } from 'firebase/storage';
import { getBrowserStorageOwner } from './browserStorage';

function sanitizePathSegment(segment: string): string {
  return segment
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

export function getUserPathOwner(uid?: string | null): string {
  return getBrowserStorageOwner(uid);
}

export function getUserDocumentPath(uid?: string | null): string {
  return `users/${getUserPathOwner(uid)}`;
}

export function getUserProjectsCollectionPath(uid?: string | null): string {
  return `${getUserDocumentPath(uid)}/projects`;
}

export function getUserProjectDocumentPath(projectId: string, uid?: string | null): string {
  return `${getUserProjectsCollectionPath(uid)}/${projectId}`;
}

export function getUserAvatarStoragePath(uid?: string | null): string {
  return `avatars/${getUserPathOwner(uid)}`;
}

export function getDisabledUserDocumentPath(uid?: string | null): string {
  return `disabledUsers/${getUserPathOwner(uid)}`;
}

export function getUserDocumentRef<T = Record<string, unknown>>(
  firestore: Firestore,
  uid?: string | null,
): DocumentReference<T> {
  return doc(firestore, getUserDocumentPath(uid)) as DocumentReference<T>;
}

export function getUserProjectsCollectionRef<T = Record<string, unknown>>(
  firestore: Firestore,
  uid?: string | null,
): CollectionReference<T> {
  return collection(firestore, getUserProjectsCollectionPath(uid)) as CollectionReference<T>;
}

export function getUserProjectDocumentRef<T = Record<string, unknown>>(
  firestore: Firestore,
  projectId: string,
  uid?: string | null,
): DocumentReference<T> {
  return doc(firestore, getUserProjectDocumentPath(projectId, uid)) as DocumentReference<T>;
}

export function getUserAvatarStorageRef(storage: FirebaseStorage, uid?: string | null): StorageReference {
  return ref(storage, getUserAvatarStoragePath(uid));
}

export function getDisabledUserDocumentRef<T = Record<string, unknown>>(
  firestore: Firestore,
  uid?: string | null,
): DocumentReference<T> {
  return doc(firestore, getDisabledUserDocumentPath(uid)) as DocumentReference<T>;
}

export function getUserScopedDownloadName(
  prefix: string,
  extension: string,
  uid?: string | null,
  ...parts: Array<string | number | null | undefined>
): string {
  const safePrefix = sanitizePathSegment(prefix);
  const safeOwner = sanitizePathSegment(getUserPathOwner(uid));
  const safeParts = parts
    .filter((part): part is string | number => part !== null && part !== undefined && `${part}`.trim().length > 0)
    .map((part) => sanitizePathSegment(String(part)));

  return [safePrefix, safeOwner, ...safeParts, Date.now()].join('-') + `.${extension}`;
}