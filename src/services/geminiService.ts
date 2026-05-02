import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY || "",
  dangerouslyAllowBrowser: true,
});

async function callGroq(prompt: string, jsonMode = false): Promise<string> {
  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });
  return completion.choices[0]?.message?.content || "";
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
}

type ApiErrorResponse = {
  code?: string;
  error?: string;
  userMessage?: string;
};

function inferFriendlyMessage(code: string | undefined, rawMessage: string, fallback: string): string {
  const normalizedCode = code?.trim().toLowerCase();
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (normalizedCode === 'quota_exceeded' || normalizedMessage.includes('credit') || normalizedMessage.includes('quota')) {
    return 'This AI provider has used up its credits for now. Please come back later or switch to another provider.';
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
      headers: { 'Content-Type': 'application/json' },
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

export async function generateIdeaDraft(payload: IdeaDraftRequest): Promise<IdeaDraftResponse> {
  const response = await fetch('/api/process/idea-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const response = await fetch('/api/youtube-to-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  };
}

/**
 * Unified function to process user-uploaded scripts (text content)
 * Generates transcript, chapters, and summary for provided text/script content
 */
export async function processUploadedScript(scriptContent: string): Promise<ProcessingResult> {
  try {
    const prompt = `You have been provided with the following script/text content:

"${scriptContent}"

Analyze this content and return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "Transcript": "A refined and properly formatted transcript of the script. Add timestamps every 30-60 seconds. Maintain the original dialogue and narration structure.",
  "Chapters": [
    { "id": "ch-1", "title": "Descriptive Title Based on Content", "timestamp": "00:00", "timeLabel": "00:00 → 02:30", "chapterName": "Descriptive Title Based on Content", "summary": "Brief 1-2 sentence summary of what happens in this section." },
    { "id": "ch-2", "title": "Next Section Title", "timestamp": "02:30", "timeLabel": "02:30 → 05:15", "chapterName": "Next Section Title", "summary": "Brief summary of this section." }
  ],
  "Summary": "A comprehensive 2-3 paragraph summary of the script's main content, key ideas, and takeaways."
}

Ensure:
- Transcript includes realistic timestamps at logical break points
- Each Chapter is a JSON object with id, title, timestamp, timeLabel, chapterName, and summary
- Chapter titles must be descriptive and specific to the content (not generic like "Introduction" or "Section 1")
- timeLabel shows the minute range (e.g. "00:00 → 02:30")
- summary is a short 1-2 sentence description of what happens in that part
- Summary accurately captures the essence of the content
- All fields are substantive and well-written`;

    const text = await callGroq(prompt, true);
    const result = JSON.parse(text || "{}");
    const rawChapters = Array.isArray(result.Chapters) ? result.Chapters : [];
    const normalizedResult: ProcessingResult = {
      Transcript: result.Transcript || "",
      Chapters: rawChapters.length > 0 && typeof rawChapters[0] === 'object'
        ? rawChapters.map((ch: any, idx: number) => ({
            id: ch.id || `ch-${idx + 1}`,
            title: ch.title || ch.chapterName || `Chapter ${idx + 1}`,
            timestamp: ch.timestamp || '00:00',
            timeLabel: ch.timeLabel || ch.timestamp || '00:00',
            chapterName: ch.chapterName || ch.title || `Chapter ${idx + 1}`,
            summary: ch.summary || '',
          }))
        : buildChapterEntries(rawChapters),
      Summary: result.Summary || ""
    };

    if (!normalizedResult.Transcript && normalizedResult.Chapters.length === 0 && !normalizedResult.Summary) {
      throw new Error('Empty Groq script response');
    }

    return normalizedResult;
  } catch (error) {
    console.warn('Falling back to backend script processor:', error);
    const backendResult = await processUserScript(scriptContent);
    return normalizeBackendScriptResult(backendResult);
  }
}
