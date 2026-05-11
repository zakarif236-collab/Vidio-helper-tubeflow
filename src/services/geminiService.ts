import { auth } from '../firebase';
import { readUserScopedStorageValue } from './browserStorage';

async function buildAuthenticatedHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return {
      'Content-Type': 'application/json',
    };
  }

  const idToken = await currentUser.getIdToken(/* forceRefresh */ true);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

export interface ChapterEntry {
  id: string;
  title: string;
  timestamp: string;
  timeLabel: string;
  chapterName: string;
  summary: string;
}

export interface ProcessingResult {
  Transcript: string;
  Chapters: ChapterEntry[];
  Summary: string;
  styleProfile?: string;
  sourceTitle?: string;
}

export interface PatternAppliedScriptResponse {
  script: string;
}

export type ScriptDurationOption = 8 | 10 | 15 | 20;

type ApiErrorResponse = {
  code?: string;
  error?: string;
  userMessage?: string;
};

function inferFriendlyMessage(code: string | undefined, rawMessage: string, fallback: string): string {
  const normalizedCode = code?.trim().toLowerCase();
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (normalizedCode === 'quota_exceeded' || normalizedMessage.includes('credit') || normalizedMessage.includes('quota')) {
    return 'You\'ve hit today\'s usage limit. Come back tomorrow for more credits, or switch to another provider.';
  }

  if (normalizedCode === 'timeout' || normalizedMessage.includes('timeout') || normalizedMessage.includes('timed out')) {
    return 'This is taking longer than usual. Please try again in a moment.';
  }

  if (normalizedCode === 'captions_unavailable' || normalizedMessage.includes('caption') || normalizedMessage.includes('subtitle')) {
    return 'This video does not have usable captions yet. Try another video or paste a script instead.';
  }

  if (normalizedCode === 'video_unavailable' || normalizedMessage.includes('private') || normalizedMessage.includes('unavailable')) {
    return 'We could not access this video. It may be private, restricted, or temporarily unavailable.';
  }

  if (normalizedCode === 'missing_configuration' || normalizedMessage.includes('api key') || normalizedMessage.includes('not configured')) {
    return 'The AI service is not configured yet. Add a valid API key, then try again.';
  }

  if (normalizedCode === 'provider_unavailable') {
    return 'The AI service is busy right now. Please try again in a moment.';
  }

  if (normalizedCode === 'invalid_input' && rawMessage.trim()) {
    return rawMessage.trim();
  }

  return fallback;
}

async function extractApiErrorMessage(response: Response, fallback: string): Promise<string> {
  let errorBody: ApiErrorResponse | null = null;

  try {
    errorBody = (await response.json()) as ApiErrorResponse;
  } catch {
    errorBody = null;
  }

  if (typeof errorBody?.userMessage === 'string' && errorBody.userMessage.trim()) {
    return errorBody.userMessage;
  }

  const rawMessage = typeof errorBody?.error === 'string' ? errorBody.error : '';
  return inferFriendlyMessage(errorBody?.code, rawMessage, fallback);
}

function buildChapterEntries(rawChapters: Array<{ timestamp: string; title: string }> | string[]): ChapterEntry[] {
  const entries: { timestamp: string; title: string }[] = [];
  for (const ch of rawChapters) {
    if (typeof ch === 'string') {
      const match = ch.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      entries.push({ timestamp: match?.[1] ?? '00:00', title: match?.[2] ?? ch });
    } else {
      entries.push({ timestamp: ch.timestamp || '00:00', title: ch.title || 'Untitled' });
    }
  }
  return entries.map((entry, idx, arr) => {
    const nextTimestamp = arr[idx + 1]?.timestamp ?? '';
    return {
      id: `ch-${idx + 1}`,
      title: entry.title,
      timestamp: entry.timestamp,
      timeLabel: nextTimestamp ? `${entry.timestamp} \u2192 ${nextTimestamp}` : `${entry.timestamp} \u2192 End`,
      chapterName: entry.title,
      summary: '',
    };
  });
}

function normalizeBackendScriptResult(result: ComprehensiveResult): ProcessingResult {
  return {
    Transcript: result.Transcript || '',
    Chapters: Array.isArray(result.Chapters)
      ? buildChapterEntries(result.Chapters)
      : [],
    Summary: typeof result.Summary === 'string'
      ? result.Summary
      : [result.Summary?.short, result.Summary?.long].filter(Boolean).join('\n\n'),
    styleProfile: undefined,
    sourceTitle: undefined,
  };
}

export interface Chapter {
  timestamp: string;
  title: string;
}

export interface ComprehensiveResult {
  Transcript: string;
  Chapters: Chapter[];
  Summary: {
    short: string;
    long: string;
  };
  SEO: {
    Title: string;
    Description: string;
    Keywords: string[];
  };
  ThumbnailIdeas: string[];
  SocialCaptions: string[];
}

export interface IdeaDraftResponse {
  draft: string;
  outline: string[];
  keywords: string[];
  sections: {
    introduction: string;
    development: string;
    climax: string;
    resolution: string;
    targetMinutes: number;
  };
  cues: Array<{
    section: 'introduction' | 'development' | 'climax' | 'resolution';
    visuals: string[];
    sounds: string[];
    emotionalBeat: string;
  }>;
  timeline: Array<{
    label: string;
    minutes: number;
    summary: string;
  }>;
  validation: {
    isValid: boolean;
    sentenceCount: number;
    issues: string[];
    sectionValidations: Array<{
      section: 'introduction' | 'development' | 'climax' | 'resolution';
      wordCount: number;
      minimumWords: number;
      isValid: boolean;
      issues: string[];
    }>;
  };
  source: 'local-nlp' | 'huggingface' | 'groq';
  seo?: {
    titles: string[];
    description: string;
    tags: string[];
    thumbnailConcepts: string[];
  } | null;
}

export interface UrlPatternAnalysis {
  hookFormula: string;
  retentionLoops: string[];
  transitionPhrases: string[];
  exampleStructure: string;
  ctaStyle: string;
  pacingBlueprint: string;
  keywordStrategy: string[];
  powerWords: string[];
  styleProfile: string;
  applicableTemplate: string;
  sourceTitle: string;
  patternContent: string;
  suggestedName: string;
  transcript?: string;
}

export interface IdeaDraftRequest {
  idea: string;
  platform?: 'youtube' | 'tiktok';
  sections?: {
    introduction?: string;
    development?: string;
    climax?: string;
    resolution?: string;
    targetMinutes?: number;
  };
}

/**
 * Process user-uploaded script using backend NLP services
 * Returns chapters, summary, SEO, and social captions
 */
export async function processUserScript(
  script: string,
  subject?: string
): Promise<ComprehensiveResult> {
  try {
    const response = await fetch('/api/process/script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ script, subject })
    });

    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, 'We could not process that script right now. Please try again in a moment.'));
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing script:', error);
    throw error;
  }
}

export async function applyPatternToScript(
  patternScript: string,
  userScript: string,
  targetMinutes: ScriptDurationOption
): Promise<PatternAppliedScriptResponse> {
  try {
    const headers = await buildAuthenticatedHeaders();
    const currentUser = auth.currentUser;
    const response = await fetch('/api/script/apply-pattern', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        patternScript,
        userScript,
        targetMinutes,
        apiKey: currentUser ? readUserScopedStorageValue('app_groq_key', currentUser.uid) || '' : '',
      })
    });

    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, 'We could not apply that pattern right now. Please try again in a moment.'));
    }

    return await response.json();
  } catch (error) {
    console.error('Error applying pattern to script:', error);
    throw error;
  }
}

export async function generateIdeaDraft(payload: IdeaDraftRequest): Promise<IdeaDraftResponse> {
  const headers = await buildAuthenticatedHeaders();
  const response = await fetch('/api/process/idea-draft', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, 'We hit a temporary problem while generating your draft. Please try again in a moment.'));
  }

  return await response.json();
}

// ========== Existing Gemini Service Functions ==========

/**
 * Unified function to process YouTube video URLs
 * Generates transcript, chapters, and summary for a YouTube URL
 */
export async function processYouTubeUrl(url: string): Promise<ProcessingResult> {
  const headers = await buildAuthenticatedHeaders();
  const response = await fetch('/api/youtube-to-script', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "We could not turn that video into a script right now. Please try again in a moment."));
  }

  const data = await response.json();

  // Map IdeaDraftResult (from /api/youtube-to-script) → ProcessingResult
  const summary = Array.isArray(data.timeline) && data.timeline.length > 0
    ? (data.timeline as Array<{ summary: string }>)
        .map((t) => t.summary)
        .filter(Boolean)
        .join('\n\n')
    : '';

  return {
    Transcript: typeof data.draft === 'string' ? data.draft : '',
    Chapters: Array.isArray(data.outline) ? buildChapterEntries(data.outline) : [],
    Summary: summary,
    styleProfile: typeof data.styleProfile === 'string' ? data.styleProfile : undefined,
    sourceTitle: typeof data.sourceTitle === 'string' ? data.sourceTitle : undefined,
  };
}

/**
 * Unified function to process user-uploaded scripts (text content)
 * Generates transcript, chapters, and summary for provided text/script content
 */
export async function analyzeUrlAsPattern(url: string): Promise<UrlPatternAnalysis> {
  const headers = await buildAuthenticatedHeaders();
  const response = await fetch('/api/script/analyze-url', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, 'We could not analyze that video right now. Please try again in a moment.'));
  }

  return await response.json();
}

export async function processUploadedScript(scriptContent: string): Promise<ProcessingResult> {
  try {
    const backendResult = await processUserScript(scriptContent);
    return normalizeBackendScriptResult(backendResult);
  } catch (error) {
    console.error('Error processing uploaded script:', error);
    throw error;
  }
}
