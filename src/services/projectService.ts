import {
  addDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { ProcessingResult } from './geminiService';
import type { Project } from '../types/firestore';
import {
  getUserAvatarStorageRef,
  getUserProjectDocumentRef,
  getUserProjectsCollectionRef,
} from './userPaths';

// ─── Projects (Firestore: users/{uid}/projects) ──────────────────────────────

type ProjectUpdateInput = {
  title: string;
  sourceType: 'youtube' | 'script';
  results: ProcessingResult;
  opts?: { sourceUrl?: string; seoTitle?: string; socialCaptions?: string[] };
};

function buildProjectPayload(
  uid: string,
  input: ProjectUpdateInput,
) {
  return {
    uid,
    title: input.title,
    sourceType: input.sourceType,
    sourceUrl: input.opts?.sourceUrl ?? null,
    summary: input.results.Summary,
    chapters: input.results.Chapters,
    transcript: input.results.Transcript,
    seoTitle: input.opts?.seoTitle ?? null,
    socialCaptions: input.opts?.socialCaptions ?? [],
  };
}

export async function saveProject(
  uid: string,
  title: string,
  sourceType: 'youtube' | 'script',
  results: ProcessingResult,
  opts?: { sourceUrl?: string; seoTitle?: string; socialCaptions?: string[] },
): Promise<string> {
  console.info('[projectService] Creating project', { uid, title, sourceType });
  const projectsRef = getUserProjectsCollectionRef(db, uid);

  try {
    const docRef = await addDoc(projectsRef, {
      ...buildProjectPayload(uid, { title, sourceType, results, opts }),
      createdAt: serverTimestamp(),
    });
    console.info('[projectService] Project created', { uid, projectId: docRef.id });
    return docRef.id;
  } catch (error) {
    console.error('[projectService] Failed to create project', { uid, title, sourceType, error });
    throw error;
  }
}

export async function updateProject(
  uid: string,
  projectId: string,
  title: string,
  sourceType: 'youtube' | 'script',
  results: ProcessingResult,
  opts?: { sourceUrl?: string; seoTitle?: string; socialCaptions?: string[] },
): Promise<void> {
  console.info('[projectService] Updating project', { uid, projectId, title, sourceType });

  try {
    await updateDoc(
      getUserProjectDocumentRef(db, projectId, uid),
      buildProjectPayload(uid, { title, sourceType, results, opts }),
    );
    console.info('[projectService] Project updated', { uid, projectId });
  } catch (error) {
    console.error('[projectService] Failed to update project', { uid, projectId, title, sourceType, error });
    throw error;
  }
}

export async function listProjects(uid: string): Promise<Project[]> {
  console.info('[projectService] Listing projects', { uid });
  const q = query(
    getUserProjectsCollectionRef<Project>(db, uid),
    orderBy('createdAt', 'desc'),
  );

  try {
    const snap = await getDocs(q);
    const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
    console.info('[projectService] Projects listed', { uid, count: projects.length });
    return projects;
  } catch (error) {
    console.error('[projectService] Failed to list projects', { uid, error });
    throw error;
  }
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
  console.info('[projectService] Deleting project', { uid, projectId });

  try {
    await deleteDoc(getUserProjectDocumentRef(db, projectId, uid));
    console.info('[projectService] Project deleted', { uid, projectId });
  } catch (error) {
    console.error('[projectService] Failed to delete project', { uid, projectId, error });
    throw error;
  }
}

// ─── Avatar (Storage: avatars/{uid}) ─────────────────────────────────────────

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  console.info('[projectService] Uploading avatar', { uid, contentType: file.type, size: file.size });
  const avatarRef = getUserAvatarStorageRef(storage, uid);

  try {
    await uploadBytes(avatarRef, file, { contentType: file.type });
    const downloadURL = await getDownloadURL(avatarRef);
    console.info('[projectService] Avatar uploaded', { uid });
    return downloadURL;
  } catch (error) {
    console.error('[projectService] Failed to upload avatar', { uid, contentType: file.type, size: file.size, error });
    throw error;
  }
}
