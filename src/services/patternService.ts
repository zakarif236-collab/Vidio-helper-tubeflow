import { readUserScopedStorageValue, writeUserScopedStorageValue } from './browserStorage';

const PATTERNS_STORAGE_KEY = 'studio-patterns';

export interface SavedPattern {
  id: string;
  name: string;
  tags: string[];
  content: string;
  source: 'youtube' | 'script' | 'idea';
  createdAt: string;
  updatedAt: string;
}

type CreateSavedPatternInput = {
  content: string;
  source: SavedPattern['source'];
  name?: string;
  tags?: string[];
};

type UpdateSavedPatternInput = {
  name?: string;
  tags?: string[];
  content?: string;
};

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(new Set((tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)));
}

function sanitizePattern(pattern: Partial<SavedPattern>): SavedPattern | null {
  if (typeof pattern.id !== 'string' || typeof pattern.name !== 'string' || typeof pattern.content !== 'string' || typeof pattern.source !== 'string') {
    return null;
  }

  if (!pattern.content.trim()) {
    return null;
  }

  return {
    id: pattern.id,
    name: pattern.name.trim() || 'Untitled Pattern',
    tags: normalizeTags(Array.isArray(pattern.tags) ? pattern.tags : []),
    content: pattern.content,
    source: pattern.source === 'youtube' || pattern.source === 'script' || pattern.source === 'idea' ? pattern.source : 'script',
    createdAt: typeof pattern.createdAt === 'string' ? pattern.createdAt : new Date().toISOString(),
    updatedAt: typeof pattern.updatedAt === 'string' ? pattern.updatedAt : new Date().toISOString(),
  };
}

function writePatterns(uid: string | null | undefined, patterns: SavedPattern[]): void {
  writeUserScopedStorageValue(PATTERNS_STORAGE_KEY, JSON.stringify(patterns), uid);
}

export function buildDefaultPatternName(source: SavedPattern['source']): string {
  const label = source === 'youtube' ? 'YouTube Pattern' : source === 'idea' ? 'Idea Pattern' : 'Script Pattern';
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16).replace(/:/g, '-');
  return `${label} ${stamp}`;
}

export function listSavedPatterns(uid?: string | null): SavedPattern[] {
  const raw = readUserScopedStorageValue(PATTERNS_STORAGE_KEY, uid);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => sanitizePattern(item))
      .filter((item): item is SavedPattern => Boolean(item))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

export function createSavedPattern(uid: string | null | undefined, input: CreateSavedPatternInput): SavedPattern {
  const now = new Date().toISOString();
  const nextPattern: SavedPattern = {
    id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name?.trim() || buildDefaultPatternName(input.source),
    tags: normalizeTags(input.tags),
    content: input.content.trim(),
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };

  const patterns = listSavedPatterns(uid);
  writePatterns(uid, [nextPattern, ...patterns]);
  return nextPattern;
}

export function updateSavedPattern(uid: string | null | undefined, patternId: string, updates: UpdateSavedPatternInput): SavedPattern[] {
  const patterns = listSavedPatterns(uid).map((pattern) => {
    if (pattern.id !== patternId) {
      return pattern;
    }

    return {
      ...pattern,
      name: updates.name !== undefined ? (updates.name.trim() || 'Untitled Pattern') : pattern.name,
      tags: updates.tags !== undefined ? normalizeTags(updates.tags) : pattern.tags,
      content: updates.content !== undefined ? updates.content.trim() : pattern.content,
      updatedAt: new Date().toISOString(),
    };
  });

  writePatterns(uid, patterns);
  return patterns;
}