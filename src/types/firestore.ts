import { Timestamp } from 'firebase/firestore';
import type { ChapterEntry } from '../services/geminiService';

// ─── users/{userId} ──────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  preferences: {
    defaultDuration: 8 | 10 | 15 | 20;
    defaultPreset: 'explainer' | 'tutorial' | 'story-arc';
    defaultProvider: 'gemini' | 'huggingface';
  };
  quota: {
    ideasThisMonth: number;
    draftsThisMonth: number;
    resetAt: Timestamp;
  };
}

// ─── users/{userId}/projects/{projectId} ─────────────────────────────────────
export interface Project {
  id: string;
  uid: string;
  title: string;
  sourceType: 'youtube' | 'script';
  sourceUrl?: string;
  summary: string;
  chapters: ChapterEntry[];
  transcript: string;
  seoTitle?: string;
  socialCaptions?: string[];
  createdAt: Timestamp;
}

