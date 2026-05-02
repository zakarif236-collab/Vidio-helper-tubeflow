import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Express, NextFunction, Request, RequestHandler, Response as ExpressResponse } from "express";
import type { Server } from "http";
import validateSections from "./sectionValidation.js";
import { createLogger, createServer as createViteServer } from "vite";
import path from "path";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import { processContent, addTimestampsToScript, buildIdeaScriptDraft } from "./contentProcessor.js";
import ytdl from "@distube/ytdl-core";

interface IdeaDraftRequestBody {
  idea?: string;
  platform?: 'youtube' | 'tiktok';
  sections?: {
    introduction?: string;
    development?: string;
    climax?: string;
    resolution?: string;
    targetMinutes?: number;
  };
}

const IDEA_DURATION_OPTIONS = [8, 10, 15, 20] as const;

function normalizeTargetMinutes(totalMinutes: number | undefined): 8 | 10 | 15 | 20 {
  if (typeof totalMinutes !== 'number' || !Number.isFinite(totalMinutes)) {
    return 15;
  }

  let bestMatch: 8 | 10 | 15 | 20 = 15;
  let bestDistance = Number.POSITIVE_INFINITY;

  IDEA_DURATION_OPTIONS.forEach((candidate) => {
    const distance = Math.abs(candidate - totalMinutes);
    if (distance < bestDistance) {
      bestMatch = candidate;
      bestDistance = distance;
    }
  });

  return bestMatch;
}

function getTargetWordCount(totalMinutes: number | undefined): number {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);
  if (normalizedMinutes === 8) {
    return 1100;
  }
  if (normalizedMinutes === 10) {
    return 1300;
  }
  if (normalizedMinutes === 20) {
    return 2400;
  }
  return 1900;
}

function getPhaseWordRange(totalMinutes: number | undefined, phase: 'introduction' | 'development' | 'climax' | 'resolution') {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);

  const ranges = {
    8: {
      introduction: { min: 100, max: 120 },
      development: { min: 350, max: 420 },
      climax: { min: 350, max: 420 },
      resolution: { min: 200, max: 240 },
    },
    10: {
      introduction: { min: 150, max: 200 },
      development: { min: 400, max: 600 },
      climax: { min: 400, max: 600 },
      resolution: { min: 250, max: 350 },
    },
    15: {
      introduction: { min: 200, max: 300 },
      development: { min: 600, max: 800 },
      climax: { min: 600, max: 800 },
      resolution: { min: 350, max: 450 },
    },
    20: {
      introduction: { min: 300, max: 400 },
      development: { min: 800, max: 1000 },
      climax: { min: 800, max: 1000 },
      resolution: { min: 450, max: 600 },
    },
  } as const;

  return ranges[normalizedMinutes][phase];
}

function getAvailableIdeaDraftProvider(): 'groq' | 'huggingface' | null {
  if (process.env.GROQ_API_KEY) {
    return 'groq';
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    return 'huggingface';
  }

  return null;
}

function getIdeaDraftProviderLabel(provider: 'groq' | 'huggingface' | null): string {
  if (provider === 'groq') {
    return 'Groq (Llama 3.3)';
  }

  if (provider === 'huggingface') {
    return 'Hugging Face';
  }

  return 'none';
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getMinimumAcceptedWordCount(totalMinutes: number | undefined): number {
  return Math.floor(getTargetWordCount(totalMinutes) * 0.9);
}

function normalizeGeneratedIdeaDraft(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\s*[*_#`>-]+\s*(Initial Concept|Develop Story|Key Moment|Wrap Up|Hook|Value|CTA)\s*[*_#`:-]*\s*$/gim, '$1')
    .replace(/\*\*(Initial Concept|Develop Story|Key Moment|Wrap Up|Hook|Value|CTA)\*\*/gi, '\n$1\n\n')
    .replace(/^\s*#+\s*(Initial Concept|Develop Story|Key Moment|Wrap Up|Hook|Value|CTA)\s*$/gim, '$1')
    .replace(/^\s*(Initial Concept|Develop Story|Key Moment|Wrap Up|Hook|Value|CTA)\s*[:\-–—]\s*/gim, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildTikTokDraftPrompt(idea: string): string {
  return [
    'You are an expert TikTok scriptwriter.',
    'Write a punchy, scroll-stopping TikTok script for the following idea.',
    '',
    'STRICT FORMAT — use these three section headings on their own lines, nothing else:',
    '',
    'Hook',
    '(3–5 seconds, 15–25 words. Open with a bold statement, question, or shocking fact that forces the viewer to keep watching.)',
    '',
    'Value',
    '(The core content in 80–120 words. Fast-paced, conversational, one-idea-per-sentence. No filler. Deliver real value or entertainment immediately.)',
    '',
    'CTA',
    '(10–20 words. One direct, specific call to action: follow, comment with X, save this, or visit somewhere.)',
    '',
    'Rules:',
    '- Total script must be 120–180 words.',
    '- Write in second person, casual spoken language, contractions encouraged.',
    '- No emojis, no hashtags, no markdown — plain text only.',
    '- Every sentence must earn its place. Cut anything vague or slow.',
    '- Use the exact headings: Hook, Value, CTA.',
    '',
    `Idea: ${idea}`,
  ].join('\n');
}

function shouldRetryIdeaDraft(text: string, totalMinutes: number | undefined): boolean {
  return countWords(text) < getMinimumAcceptedWordCount(totalMinutes);
}

function buildIdeaDraftPrompt(
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  retryOptions?: { minimumWords: number; previousWordCount: number; existingDraft?: string },
  platform?: 'youtube' | 'tiktok'
): string {
  if (platform === 'tiktok') {
    return buildTikTokDraftPrompt(idea);
  }
  const targetMinutes = normalizeTargetMinutes(sections?.targetMinutes);
  const targetWords = getTargetWordCount(targetMinutes);
  const minimumWords = retryOptions?.minimumWords ?? getMinimumAcceptedWordCount(targetMinutes);
  const introductionWordRange = getPhaseWordRange(targetMinutes, 'introduction');
  const developmentWordRange = getPhaseWordRange(targetMinutes, 'development');
  const climaxWordRange = getPhaseWordRange(targetMinutes, 'climax');
  const resolutionWordRange = getPhaseWordRange(targetMinutes, 'resolution');

  return [
    'You are a professional scriptwriter.',
    'Expand the following idea into a full spoken script.',
    `Adjust the phase lengths based on the total duration selected: ${targetMinutes} minutes.`,
    '',
    'Structure:',
    '',
    `- Initial Concept (~10% of total time): Hook, context, and promise. Write ${introductionWordRange.min}-${introductionWordRange.max} words.`,
    `- Develop Story (~35% of total time): Provide 3-4 examples, dialogue beats, and practical context. Write ${developmentWordRange.min}-${developmentWordRange.max} words.`,
    `- Key Moment (~35% of total time): Reveal the turning point, strongest insight, or emotional peak. Write ${climaxWordRange.min}-${climaxWordRange.max} words.`,
    `- Wrap Up (~20% of total time): End with a clear takeaway and call to action. Write ${resolutionWordRange.min}-${resolutionWordRange.max} words.`,
    '',
    'Rules:',
    '- Write in natural spoken style, not bullet points.',
    '- Use transitions between sections.',
    '- Avoid repeating the idea verbatim; expand it into full sentences.',
    `- Target total length: about ${targetWords} words for a ${targetMinutes}-minute script.`,
    `- Aim for roughly ${targetWords} words overall, but do not go below ${minimumWords} words.`,
    `- Minimum acceptable length: ${minimumWords} words. Do not stop early.`,
    '- Do not use markdown, bullet lists, or bold formatting anywhere in the output.',
    '- Use these exact section headings on their own lines: Initial Concept, Develop Story, Key Moment, Wrap Up.',
    '- Return plain text only.',
    '',
    `Subject: ${idea}`,
    `Initial Concept notes: ${sections?.introduction || 'none provided'}`,
    `Develop Story notes: ${sections?.development || 'none provided'}`,
    `Key Moment notes: ${sections?.climax || 'none provided'}`,
    `Wrap Up notes: ${sections?.resolution || 'none provided'}`,
    retryOptions
      ? `Rewrite the draft so it is significantly fuller than the previous ${retryOptions.previousWordCount}-word attempt. Expand further to reach ${targetWords} words while keeping the same four-section structure.`
      : '',
    retryOptions?.existingDraft
      ? ['Current draft to expand and improve:', retryOptions.existingDraft].join('\n\n')
      : '',
  ].join('\n');
}

async function expandIdeaWithGroq(
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  retryOptions?: { minimumWords: number; previousWordCount: number; existingDraft?: string },
  errorCapture?: { message: string },
  platform?: 'youtube' | 'tiktok'
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return null;
  }

  const prompt = buildIdeaDraftPrompt(idea, sections, retryOptions, platform);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: platform === 'tiktok' ? 600 : normalizeTargetMinutes(sections?.targetMinutes) === 20 ? 6000 : normalizeTargetMinutes(sections?.targetMinutes) === 15 ? 4500 : 3500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        detail = parsed?.error?.message || parsed?.error || parsed?.message || errorText;
      } catch {
        detail = errorText || detail;
      }
      console.warn(`Groq idea expansion failed (${response.status}):`, detail);
      if (errorCapture) {
        errorCapture.message = `Groq error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
      }
      return null;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.warn('Groq idea expansion request failed:', error);
    return null;
  }
}

async function expandIdeaWithHuggingFace(
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  retryOptions?: { minimumWords: number; previousWordCount: number; existingDraft?: string },
  errorCapture?: { message: string },
  platform?: 'youtube' | 'tiktok'
): Promise<string | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_MODEL || "Qwen/Qwen2.5-72B-Instruct";

  if (!apiKey) {
    return null;
  }

  const prompt = buildIdeaDraftPrompt(idea, sections, retryOptions, platform);

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: platform === 'tiktok' ? 500 : normalizeTargetMinutes(sections?.targetMinutes) === 20 ? 4800 : normalizeTargetMinutes(sections?.targetMinutes) === 15 ? 3800 : normalizeTargetMinutes(sections?.targetMinutes) === 10 ? 2800 : 2200,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        detail = parsed?.error?.message || parsed?.error || parsed?.message || errorText;
      } catch {
        detail = errorText || detail;
      }
      console.warn(`Hugging Face idea expansion failed (${response.status} — model: ${model}):`, detail);
      if (errorCapture) {
        errorCapture.message = `HuggingFace error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
      }
      return null;
    }

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const joined = content
        .map((part: { text?: string; type?: string }) => typeof part?.text === 'string' ? part.text : '')
        .join('')
        .trim();

      if (joined) {
        return joined;
      }
    }

    return null;
  } catch (error) {
    console.warn("Hugging Face idea expansion request failed:", error);
    return null;
  }
}

async function generateIdeaDraftWithProvider(
  provider: 'groq' | 'huggingface',
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  providerErrorCapture?: { message: string },
  platform?: 'youtube' | 'tiktok'
): Promise<string | null> {
  // TikTok scripts are intentionally short — single attempt, no word-count retry.
  if (platform === 'tiktok') {
    const generatedDraft = provider === 'groq'
      ? await expandIdeaWithGroq(idea, sections, undefined, providerErrorCapture, 'tiktok')
      : await expandIdeaWithHuggingFace(idea, sections, undefined, providerErrorCapture, 'tiktok');
    return generatedDraft ? normalizeGeneratedIdeaDraft(generatedDraft) : null;
  }

  const minimumWords = getMinimumAcceptedWordCount(sections?.targetMinutes);
  const maxAttempts = 3;
  let currentDraft: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const retryOptions = attempt === 1 || !currentDraft
      ? undefined
      : {
          minimumWords,
          previousWordCount: countWords(currentDraft),
          existingDraft: currentDraft,
        };

    const generatedDraft = provider === 'groq'
      ? await expandIdeaWithGroq(idea, sections, retryOptions, providerErrorCapture)
      : await expandIdeaWithHuggingFace(idea, sections, retryOptions, providerErrorCapture);

    if (!generatedDraft) {
      if (attempt > 1) {
        console.warn(`Idea-draft retry ${attempt - 1} failed to return content for ${provider}.`);
      }
      continue;
    }

    currentDraft = normalizeGeneratedIdeaDraft(generatedDraft);
    const currentWordCount = countWords(currentDraft);

    if (attempt === 1) {
      console.log(`Idea-draft initial word count (${provider}): ${currentWordCount}`);
    } else {
      console.log(`Idea-draft retry ${attempt - 1} word count (${provider}): ${currentWordCount}`);
    }

    if (!shouldRetryIdeaDraft(currentDraft, sections?.targetMinutes)) {
      return currentDraft;
    }
  }

  return currentDraft;
}

// ── YouTube helpers ───────────────────────────────────────────────────────────

function extractYouTubeVideoId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '');
}

async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs: number = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init ?? {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type ApiErrorCode =
  | 'invalid_input'
  | 'missing_configuration'
  | 'captions_unavailable'
  | 'video_unavailable'
  | 'quota_exceeded'
  | 'payload_too_large'
  | 'rate_limited'
  | 'timeout'
  | 'provider_unavailable'
  | 'processing_failed';

function sendApiError(
  res: ExpressResponse,
  status: number,
  code: ApiErrorCode,
  error: string,
  userMessage: string
) {
  return res.status(status).json({ code, error, userMessage });
}

function classifyTranscriptError(error: string): { code: ApiErrorCode; userMessage: string } {
  const normalized = error.toLowerCase();

  if (normalized.includes('caption') || normalized.includes('subtitle')) {
    return {
      code: 'captions_unavailable',
      userMessage: 'This video does not have usable captions yet. Try another video or paste a script instead.',
    };
  }

  if (
    normalized.includes('age-restricted') ||
    normalized.includes('private') ||
    normalized.includes('unavailable')
  ) {
    return {
      code: 'video_unavailable',
      userMessage: 'We could not access this video. It may be private, restricted, or temporarily unavailable.',
    };
  }

  if (
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('network error') ||
    normalized.includes('internet connection')
  ) {
    return {
      code: 'timeout',
      userMessage: 'This is taking longer than usual. Please try again in a moment.',
    };
  }

  return {
    code: 'processing_failed',
    userMessage: 'We could not turn that video into a script right now. Please try again in a moment.',
  };
}

function classifyProviderError(error: string): { code: ApiErrorCode; userMessage: string } {
  const normalized = error.toLowerCase();

  if (
    normalized.includes('402') ||
    normalized.includes('credit') ||
    normalized.includes('quota') ||
    normalized.includes('rate limit')
  ) {
    return {
      code: 'quota_exceeded',
      userMessage: 'This AI provider has run out of credits for now. Please come back later or switch to another provider.',
    };
  }

  if (
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('abort')
  ) {
    return {
      code: 'timeout',
      userMessage: 'The AI request is taking longer than usual. Please try again in a moment.',
    };
  }

  if (
    normalized.includes('api key') ||
    normalized.includes('not configured') ||
    normalized.includes('model access')
  ) {
    return {
      code: 'missing_configuration',
      userMessage: 'The AI service is not configured yet. Add a valid API key, then try again.',
    };
  }

  return {
    code: 'provider_unavailable',
    userMessage: 'The AI service is busy right now. Please try again in a moment.',
  };
}

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  scope: string;
  userMessage: string;
};

const MAX_JSON_BODY_SIZE = '1mb';
const MAX_SUBJECT_LENGTH = 200;
const MAX_URL_LENGTH = 500;
const MAX_IDEA_LENGTH = 4000;
const MAX_PROMPT_LENGTH = 4000;
const MAX_SECTION_NOTE_LENGTH = 5000;
const MAX_SCRIPT_LENGTH = 200_000;
const MAX_TRANSCRIPT_LENGTH = 200_000;

const requestBuckets = new Map<string, RateLimitBucket>();

const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of requestBuckets.entries()) {
    if (bucket.resetAt <= now) {
      requestBuckets.delete(key);
    }
  }
}, 60_000);

rateLimitCleanupTimer.unref();

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwarded = forwardedValue?.split(',')[0]?.trim();

  return firstForwarded || req.ip || req.socket.remoteAddress || 'unknown';
}

function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const clientIdentifier = getClientIdentifier(req);
    const bucketKey = `${options.scope}:${clientIdentifier}`;
    const bucket = requestBuckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      requestBuckets.set(bucketKey, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    if (bucket.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return sendApiError(
        res,
        429,
        'rate_limited',
        `Rate limit exceeded for ${options.scope}`,
        options.userMessage
      );
    }

    bucket.count += 1;
    return next();
  };
}

function enforceMaxLength(
  res: ExpressResponse,
  value: unknown,
  fieldLabel: string,
  maxLength: number,
  userMessage: string
): ExpressResponse | null {
  if (typeof value === 'string' && value.length > maxLength) {
    return sendApiError(
      res,
      413,
      'payload_too_large',
      `${fieldLabel} exceeds the ${maxLength}-character limit.`,
      userMessage
    );
  }

  return null;
}

function validateIdeaDraftSections(
  res: ExpressResponse,
  sections: IdeaDraftRequestBody['sections'] | undefined
): ExpressResponse | null {
  if (!sections) {
    return null;
  }

  const sectionFields: Array<[string, string | undefined]> = [
    ['Introduction notes', sections.introduction],
    ['Development notes', sections.development],
    ['Climax notes', sections.climax],
    ['Resolution notes', sections.resolution],
  ];

  for (const [fieldLabel, value] of sectionFields) {
    const lengthError = enforceMaxLength(
      res,
      value,
      fieldLabel,
      MAX_SECTION_NOTE_LENGTH,
      'One of the section notes is too large. Shorten it and try again.'
    );

    if (lengthError) {
      return lengthError;
    }
  }

  return null;
}

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
};

const MAX_GROQ_AUDIO_BYTES = 24 * 1024 * 1024;
const YOUTUBE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getYouTubeRequestHeaders(additional: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': YOUTUBE_USER_AGENT,
    ...additional,
  };

  const cookie = process.env.YOUTUBE_COOKIE?.trim();
  if (cookie) {
    headers.Cookie = cookie;
  }

  return headers;
}

function parseYouTubeCookies(): Array<{ name: string; value: string; domain: string; path: string; secure: boolean }> {
  const raw = process.env.YOUTUBE_COOKIE?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eqIndex = part.indexOf('=');
      if (eqIndex <= 0) {
        return null;
      }

      const name = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      if (!name) {
        return null;
      }

      return {
        name,
        value,
        domain: '.youtube.com',
        path: '/',
        secure: true,
      };
    })
    .filter((cookie): cookie is { name: string; value: string; domain: string; path: string; secure: boolean } => !!cookie);
}

function getYtdlAgent() {
  const cookies = parseYouTubeCookies();
  if (cookies.length === 0) {
    return undefined;
  }

  try {
    return ytdl.createAgent(cookies as any);
  } catch {
    return undefined;
  }
}

type CommandCandidate = {
  command: string;
  prefixArgs?: string[];
};

function getYtDlpCandidates(): CommandCandidate[] {
  const candidates: CommandCandidate[] = [];

  const configuredPath = process.env.YTDLP_PATH?.trim();
  if (configuredPath) {
    candidates.push({ command: configuredPath });
  }

  candidates.push({ command: 'yt-dlp' });
  candidates.push({ command: 'yt-dlp.exe' });
  candidates.push({ command: 'py', prefixArgs: ['-m', 'yt_dlp'] });
  candidates.push({ command: 'python', prefixArgs: ['-m', 'yt_dlp'] });

  return candidates;
}

function runCommandWithTimeout(
  candidate: CommandCandidate,
  args: string[],
  timeoutMs: number
): Promise<{ code: number | null; stdout: string; stderr: string; notFound: boolean }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(candidate.command, [...(candidate.prefixArgs ?? []), ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      if (!settled) {
        child.kill('SIGKILL');
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve({
        code: null,
        stdout,
        stderr: `${stderr}${error.message}`,
        notFound: error.code === 'ENOENT',
      });
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, notFound: false });
    });
  });
}

async function writeYouTubeCookieFile(tempDir: string): Promise<string | null> {
  const cookiePairs = parseYouTubeCookies();
  if (cookiePairs.length === 0) {
    return null;
  }

  const filePath = path.join(tempDir, 'youtube-cookies.txt');
  const lines = [
    '# Netscape HTTP Cookie File',
    ...cookiePairs.map((cookie) => {
      const secureFlag = cookie.secure ? 'TRUE' : 'FALSE';
      return `${cookie.domain}\tTRUE\t${cookie.path}\t${secureFlag}\t0\t${cookie.name}\t${cookie.value}`;
    }),
  ];

  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  return filePath;
}

async function transcribeAudioBufferWithGroq(
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const form = new FormData();
  form.append('model', 'whisper-large-v3-turbo');
  form.append('temperature', '0');
  form.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);

  const transcriptionResp = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    },
    420000
  );

  if (!transcriptionResp.ok) {
    const detail = await transcriptionResp.text();
    throw new Error(`Status code: ${transcriptionResp.status}. ${detail.slice(0, 120)}`);
  }

  const payload = await transcriptionResp.json();
  const transcript = typeof payload?.text === 'string' ? payload.text.trim() : '';
  return transcript || null;
}

async function transcribeYouTubeAudioWithYtDlp(
  videoId: string
): Promise<{ title: string; transcript: string } | { error: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { error: 'Groq API key is missing for yt-dlp audio transcription fallback.' };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tubeflow-ytdlp-'));
  const outputTemplate = path.join(tempDir, `youtube-${videoId}.%(ext)s`);
  let cookieFilePath: string | null = null;

  try {
    cookieFilePath = await writeYouTubeCookieFile(tempDir);

    const baseArgs = [
      '--no-playlist',
      '--no-progress',
      '--no-warnings',
      '--quiet',
      '-f',
      '249/250/251/bestaudio',
      '-o',
      outputTemplate,
    ];

    if (cookieFilePath) {
      baseArgs.push('--cookies', cookieFilePath);
    }

    baseArgs.push('--add-header', `User-Agent:${YOUTUBE_USER_AGENT}`);
    baseArgs.push(`https://www.youtube.com/watch?v=${videoId}`);

    const candidates = getYtDlpCandidates();
    let lastError = 'yt-dlp is not available.';

    for (const candidate of candidates) {
      const result = await runCommandWithTimeout(candidate, baseArgs, 240000);
      if (result.notFound) {
        continue;
      }

      if (result.code !== 0) {
        lastError = (result.stderr || result.stdout || `Exit code ${result.code}`).slice(0, 180);
        continue;
      }

      const files = await fs.readdir(tempDir);
      const audioFile = files.find((file) => file.startsWith(`youtube-${videoId}.`));
      if (!audioFile) {
        lastError = 'yt-dlp completed but no audio file was produced.';
        continue;
      }

      const audioPath = path.join(tempDir, audioFile);
      const audioBuffer = await fs.readFile(audioPath);

      if (audioBuffer.byteLength === 0) {
        lastError = 'yt-dlp downloaded an empty audio file.';
        continue;
      }

      if (audioBuffer.byteLength > MAX_GROQ_AUDIO_BYTES) {
        return {
          error:
            'Audio track is too large for fallback transcription. Try a shorter video or one with captions enabled.',
        };
      }

      const extension = path.extname(audioFile).replace('.', '').toLowerCase() || 'webm';
      const mimeType = extension === 'm4a'
        ? 'audio/mp4'
        : extension === 'mp3'
          ? 'audio/mpeg'
          : extension === 'ogg'
            ? 'audio/ogg'
            : 'audio/webm';

      const transcript = await transcribeAudioBufferWithGroq(audioBuffer, mimeType, audioFile);
      if (!transcript) {
        lastError = 'Groq returned empty text for yt-dlp audio.';
        continue;
      }

      console.log(`Generated transcript via yt-dlp fallback for ${videoId}`);
      return { title: 'YouTube Video', transcript };
    }

    return { error: `yt-dlp fallback failed: ${lastError}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `yt-dlp fallback failed: ${detail.slice(0, 180)}` };
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup failure.
    }
  }
}

async function transcribeYouTubeAudio(
  videoId: string
): Promise<{ title: string; transcript: string } | { error: string }> {
  const ytdlpResult = await transcribeYouTubeAudioWithYtDlp(videoId);
  if (!('error' in ytdlpResult)) {
    return ytdlpResult;
  }

  const ytdlCoreResult = await transcribeYouTubeAudioWithGroq(videoId);
  if (!('error' in ytdlCoreResult)) {
    return ytdlCoreResult;
  }

  return {
    error: `${ytdlCoreResult.error} yt-dlp fallback also failed: ${ytdlpResult.error}`,
  };
}

function pickCaptionTrack(rawTracks: unknown[]): CaptionTrack | undefined {
  const tracks = (rawTracks ?? []).filter((track): track is CaptionTrack => {
    return typeof track === 'object' && track !== null;
  });

  const withBaseUrl = tracks.filter((track) => typeof track.baseUrl === 'string' && track.baseUrl.length > 0);
  if (withBaseUrl.length === 0) {
    return undefined;
  }

  return (
    withBaseUrl.find((track) => track.languageCode === 'en' && track.kind !== 'asr') ||
    withBaseUrl.find((track) => String(track.languageCode ?? '').startsWith('en') && track.kind !== 'asr') ||
    withBaseUrl.find((track) => track.languageCode === 'en') ||
    withBaseUrl.find((track) => String(track.languageCode ?? '').startsWith('en')) ||
    withBaseUrl[0]
  );
}

function extractTranscriptLinesFromJson3(payload: any): string[] {
  const events = Array.isArray(payload?.events) ? payload.events : [];

  return events
    .flatMap((event: any) => {
      const segments = Array.isArray(event?.segs) ? event.segs : [];
      const combined = segments
        .map((segment: any) => decodeXmlEntities(String(segment?.utf8 ?? '')))
        .join('')
        .trim();
      return combined ? [combined] : [];
    })
    .filter(Boolean);
}

async function fetchCaptionLines(baseUrl: string): Promise<string[]> {
  const json3Url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}fmt=json3`;

  try {
    const jsonResp = await fetchWithTimeout(json3Url, {
      headers: getYouTubeRequestHeaders(),
    }, 12000);
    if (jsonResp.ok) {
      const payload = await jsonResp.json();
      const lines = extractTranscriptLinesFromJson3(payload);
      if (lines.length > 0) {
        return lines;
      }
    }
  } catch {
    // Fallback to XML parsing below.
  }

  const xmlResp = await fetchWithTimeout(baseUrl, {
    headers: getYouTubeRequestHeaders(),
  }, 12000);
  if (!xmlResp.ok) {
    return [];
  }

  const xml = await xmlResp.text();
  return Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
    .map((m) => decodeXmlEntities(m[1]).trim())
    .filter(Boolean);
}

async function hasPublicCaptionTracks(videoId: string): Promise<boolean> {
  try {
    const url = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
    const response = await fetchWithTimeout(url, {
      headers: getYouTubeRequestHeaders(),
    }, 10000);

    if (!response.ok) {
      return false;
    }

    const xml = await response.text();
    return /<track\b/i.test(xml);
  } catch {
    return false;
  }
}

async function fetchYouTubeTranscriptViaYtdl(
  videoId: string
): Promise<{ title: string; transcript: string } | { error: string }> {
  try {
    const agent = getYtdlAgent();
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, {
      agent,
      requestOptions: {
        headers: getYouTubeRequestHeaders(),
      },
    });

    const title = info?.videoDetails?.title ?? 'YouTube Video';
    const tracks = info?.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const track = pickCaptionTrack(tracks);

    if (!track?.baseUrl) {
      return {
        error:
          "This video doesn't have captions available. " +
          'Try a video that has subtitles or closed captions enabled.',
      };
    }

    const lines = await fetchCaptionLines(track.baseUrl);
    if (lines.length === 0) {
      return { error: 'Caption file was empty. This video may not have readable captions.' };
    }

    console.log(`Extracted ${lines.length} caption lines for ${videoId} (fallback: ytdl)`);
    return { title, transcript: lines.join(' ') };
  } catch {
    return { error: 'Video is unavailable.' };
  }
}

async function transcribeYouTubeAudioWithGroq(
  videoId: string
): Promise<{ title: string; transcript: string } | { error: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { error: 'Groq API key is missing for audio transcription fallback.' };
  }

  try {
    const agent = getYtdlAgent();
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, {
      agent,
      requestOptions: {
        headers: getYouTubeRequestHeaders(),
      },
    });

    const title = info?.videoDetails?.title ?? 'YouTube Video';
    const selectedFormat = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    if (!selectedFormat) {
      return { error: 'Could not locate an audio stream for transcription.' };
    }

    const declaredLength = Number(selectedFormat.contentLength || 0);
    if (declaredLength > MAX_GROQ_AUDIO_BYTES) {
      return {
        error:
          'Audio track is too large for fallback transcription. Try a shorter video or one with captions enabled.',
      };
    }

    const audioStream = ytdl.downloadFromInfo(info, {
      quality: selectedFormat.itag,
      filter: 'audioonly',
      agent,
      requestOptions: {
        headers: getYouTubeRequestHeaders(),
      },
    });

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of audioStream as AsyncIterable<Buffer | Uint8Array | string>) {
      const bufferChunk = Buffer.isBuffer(chunk)
        ? chunk
        : typeof chunk === 'string'
          ? Buffer.from(chunk)
          : Buffer.from(chunk);

      totalBytes += bufferChunk.byteLength;
      if (totalBytes > MAX_GROQ_AUDIO_BYTES) {
        audioStream.destroy();
        return {
          error:
            'Audio track is too large for fallback transcription. Try a shorter video or one with captions enabled.',
        };
      }

      chunks.push(bufferChunk);
    }

    if (chunks.length === 0) {
      return { error: 'Downloaded audio was empty.' };
    }

    const mimeType = String(selectedFormat.mimeType || '').split(';')[0] || 'audio/webm';
    const extension = (selectedFormat.container || 'webm').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webm';
    const fileName = `youtube-${videoId}.${extension}`;

    const transcript = await transcribeAudioBufferWithGroq(Buffer.concat(chunks), mimeType, fileName);

    if (!transcript) {
      return { error: 'Fallback transcription returned no text.' };
    }

    console.log(`Generated transcript via Groq audio fallback for ${videoId}`);
    return { title, transcript };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const normalized = detail.toLowerCase();

    if (
      normalized.includes('failed to find any playable formats') ||
      normalized.includes('status code: 403') ||
      normalized.includes('forbidden')
    ) {
      const ytdlpFallback = await transcribeYouTubeAudioWithYtDlp(videoId);
      if (!('error' in ytdlpFallback)) {
        return ytdlpFallback;
      }

      return {
        error:
          'YouTube blocked audio extraction for this video from server-side requests. ' +
          `yt-dlp fallback also failed: ${ytdlpFallback.error}`,
      };
    }

    return { error: `Audio transcription fallback failed for this video: ${detail.slice(0, 180)}` };
  }
}

/**
 * Fetch transcript using YouTube's InnerTube API (youtubei/v1/player).
 * Tries multiple client strategies (IOS → WEB) to work around YouTube's
 * po_token requirement that causes "Video unavailable" for bot-like requests.
 * Returns the video title + plain-text transcript, or an { error } string.
 */
async function fetchYouTubeTranscript(
  videoId: string
): Promise<{ title: string; transcript: string } | { error: string }> {
  const hasTracks = await hasPublicCaptionTracks(videoId);
  if (!hasTracks) {
    const audioFallback = await transcribeYouTubeAudio(videoId);
    if (!('error' in audioFallback)) {
      return audioFallback;
    }

    return {
      error:
        "This video is public, but captions are not available for extraction. " +
        `Audio fallback also failed: ${audioFallback.error}`,
    };
  }

  // Strategies tried in order. IOS client bypasses the po_token gate that
  // causes the WEB client to return UNPLAYABLE for many videos.
  const strategies: Array<{
    clientNameHeader: string;
    clientVersionHeader: string;
    context: Record<string, unknown>;
  }> = [
    {
      clientNameHeader: '3',
      clientVersionHeader: '19.35.36',
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.35.36',
          androidSdkVersion: 34,
          osName: 'Android',
          osVersion: '14',
          hl: 'en',
          gl: 'US',
        },
      },
    },
    {
      clientNameHeader: '5',
      clientVersionHeader: '19.45.4',
      context: {
        client: {
          clientName: 'IOS',
          clientVersion: '19.45.4',
          deviceMake: 'Apple',
          deviceModel: 'iPhone16,2',
          osName: 'iPhone',
          osVersion: '18.1.0',
          hl: 'en',
          gl: 'US',
        },
      },
    },
    {
      clientNameHeader: '1',
      clientVersionHeader: '2.20250901.00.00',
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20250901.00.00',
          hl: 'en',
          gl: 'US',
        },
      },
    },
    {
      clientNameHeader: '2',
      clientVersionHeader: '2.20250901.00.00',
      context: {
        client: {
          clientName: 'MWEB',
          clientVersion: '2.20250901.00.00',
          hl: 'en',
          gl: 'US',
        },
      },
    },
  ];

  let lastError = 'Failed to access video.';

  for (const strategy of strategies) {
    // ── Step 1: get player response (title + caption tracks) ──────────────
    let playerData: any;
    try {
      const playerResp = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
          method: 'POST',
          headers: getYouTubeRequestHeaders({
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': strategy.clientNameHeader,
            'X-YouTube-Client-Version': strategy.clientVersionHeader,
            Origin: 'https://www.youtube.com',
            Referer: `https://www.youtube.com/watch?v=${videoId}`,
          }),
          body: JSON.stringify({
            videoId,
            context: strategy.context,
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        },
        12000
      );

      if (!playerResp.ok) {
        lastError = `Could not reach YouTube (HTTP ${playerResp.status}). Check your internet connection.`;
        continue;
      }

      playerData = await playerResp.json();
    } catch (err) {
      lastError = 'Network error while contacting YouTube. Check your internet connection.';
      continue;
    }

    // ── Step 2: check video availability ──────────────────────────────────
    const playStatus: string = playerData?.playabilityStatus?.status ?? '';
    if (playStatus === 'LOGIN_REQUIRED') {
      return { error: 'This video is age-restricted or private and cannot be accessed.' };
    }
    if (playStatus === 'UNPLAYABLE' || playStatus === 'ERROR') {
      const reason: string =
        playerData?.playabilityStatus?.reason ?? 'Video is unavailable.';
      lastError = reason;
      continue; // try next client strategy
    }

    const title: string = playerData?.videoDetails?.title ?? 'YouTube Video';

    // ── Step 3: find caption tracks ───────────────────────────────────────
    const tracks: any[] =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    if (tracks.length === 0) {
      const audioFallback = await transcribeYouTubeAudio(videoId);
      if (!('error' in audioFallback)) {
        return audioFallback;
      }

      return {
        error:
          "This video doesn't have captions available. " +
          `Audio fallback also failed: ${audioFallback.error}`,
      };
    }

    const track = pickCaptionTrack(tracks);

    if (!track?.baseUrl) {
      return { error: 'Caption track URL not found for this video.' };
    }

    // ── Step 4: fetch + parse caption XML ────────────────────────────────
    try {
      const lines = await fetchCaptionLines(track.baseUrl);

      if (lines.length === 0) {
        const audioFallback = await transcribeYouTubeAudio(videoId);
        if (!('error' in audioFallback)) {
          return audioFallback;
        }

        return {
          error:
            'Caption file was empty. This video may not have readable captions. ' +
            `Audio fallback also failed: ${audioFallback.error}`,
        };
      }

      const clientName = (strategy.context.client as any).clientName;
      console.log(`Extracted ${lines.length} caption lines for ${videoId} (client: ${clientName})`);
      return { title, transcript: lines.join(' ') };
    } catch (err) {
      lastError = 'Error downloading caption data from YouTube.';
      continue;
    }
  }

  const fallback = await fetchYouTubeTranscriptViaYtdl(videoId);
  if (!('error' in fallback)) {
    return fallback;
  }

  const normalizedError = (lastError || fallback.error || '').trim().toLowerCase();
  if (
    normalizedError === 'video unavailable' ||
    normalizedError === 'video is unavailable.' ||
    normalizedError.includes('video unavailable')
  ) {
    const hasTracksAtEnd = await hasPublicCaptionTracks(videoId);
    if (!hasTracksAtEnd) {
      const audioFallback = await transcribeYouTubeAudio(videoId);
      if (!('error' in audioFallback)) {
        return audioFallback;
      }

      return {
        error:
          "This video is public, but captions are not available for extraction. " +
          `Audio fallback also failed: ${audioFallback.error}`,
      };
    }
  }

  return { error: lastError || fallback.error };
}

async function listenWithFallback(app: Express, preferredPort: number, maxAttempts: number = 20): Promise<{ server: Server; port: number }> {
  let currentPort = preferredPort;

  type ListenResult = { ok: true; server: Server } | { ok: false; error: NodeJS.ErrnoException };

  const isListenError = (result: ListenResult): result is { ok: false; error: NodeJS.ErrnoException } => result.ok === false;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await new Promise<ListenResult>((resolve) => {
      const server = app.listen(currentPort, "0.0.0.0");

      server.once('listening', () => {
        resolve({ ok: true, server });
      });

      server.once('error', (error: NodeJS.ErrnoException) => {
        resolve({ ok: false, error });
      });
    });

    if (isListenError(result)) {
      if (result.error.code !== 'EADDRINUSE') {
        throw result.error;
      }
      currentPort += 1;
      continue;
    }

    return { server: result.server, port: currentPort };
  }

  throw new Error(`Could not bind server to any port between ${preferredPort} and ${preferredPort + maxAttempts - 1}.`);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const activeIdeaDraftProvider = getAvailableIdeaDraftProvider();
  const apiLimiter = createRateLimitMiddleware({
    scope: 'api',
    windowMs: 60_000,
    maxRequests: 60,
    userMessage: 'Too many requests from this connection. Please wait a minute and try again.',
  });
  const aiGenerationLimiter = createRateLimitMiddleware({
    scope: 'ai-generation',
    windowMs: 10 * 60_000,
    maxRequests: 12,
    userMessage: 'Too many AI generation requests from this connection. Please wait a few minutes before trying again.',
  });

  console.log(`Idea-draft provider: ${getIdeaDraftProviderLabel(activeIdeaDraftProvider)}${activeIdeaDraftProvider ? ' (active)' : ' (not configured)'}`);

  // Enable JSON body parsing for POST requests
  app.set('trust proxy', true);
  app.use(express.json({ limit: MAX_JSON_BODY_SIZE }));
  app.use((error: Error & { type?: string }, _req: Request, res: ExpressResponse, next: NextFunction) => {
    if (error.type === 'entity.too.large') {
      return sendApiError(
        res,
        413,
        'payload_too_large',
        `Request body exceeds the ${MAX_JSON_BODY_SIZE} limit.`,
        'That request is too large to process. Please shorten the content and try again.'
      );
    }

    return next(error);
  });
  app.use('/api', apiLimiter);

  // ===== YOUTUBE URL → TRANSCRIPT → SCRIPT ENDPOINT =====
  app.post("/api/youtube-to-script", aiGenerationLimiter, async (req, res) => {
    const { url } = req.body as { url?: string };

    if (!url || typeof url !== 'string') {
      return sendApiError(res, 400, 'invalid_input', 'YouTube URL is required', 'Please enter a YouTube URL to continue.');
    }

    const urlLengthError = enforceMaxLength(
      res,
      url,
      'YouTube URL',
      MAX_URL_LENGTH,
      'That YouTube URL is unexpectedly long. Please use a standard video link and try again.'
    );
    if (urlLengthError) {
      return urlLengthError;
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return sendApiError(
        res,
        400,
        'invalid_input',
        'Invalid YouTube URL. Please use a standard YouTube video link.',
        'That link does not look like a valid YouTube video URL. Please check it and try again.'
      );
    }

    const provider = getAvailableIdeaDraftProvider();
    if (!provider) {
      return sendApiError(
        res,
        503,
        'missing_configuration',
        'Missing AI API key. Set GROQ_API_KEY or HUGGINGFACE_API_KEY in your .env, then restart the server.',
        'The AI service is not configured yet. Add an API key, then try again.'
      );
    }

    console.log(`Processing YouTube video: ${videoId}`);

    // Step 1: fetch transcript via InnerTube API
    const transcriptResult = await fetchYouTubeTranscript(videoId);
    if ('error' in transcriptResult) {
      console.log(`Transcript fetch failed for ${videoId}: ${transcriptResult.error}`);
      const classified = classifyTranscriptError(transcriptResult.error);
      return sendApiError(res, 422, classified.code, transcriptResult.error, classified.userMessage);
    }

    const { title, transcript } = transcriptResult;

    // Step 2: build AI prompt
    const idea =
      `Adapt this YouTube video into a structured spoken script.\n\nTitle: ${title}\n\nTranscript:\n${
        transcript.slice(0, 4000)
      }`;

    // Step 3: generate script phases via AI
    const groqErrorCapture: { message: string } = { message: '' };
    const hfErrorCapture: { message: string } = { message: '' };
    let resultProvider: 'groq' | 'huggingface' = provider;

    let expandedIdea = await generateIdeaDraftWithProvider(
      provider, idea, { targetMinutes: 10 },
      provider === 'groq' ? groqErrorCapture : hfErrorCapture
    );

    if (!expandedIdea) {
      const fallback: 'groq' | 'huggingface' = provider === 'huggingface' ? 'groq' : 'huggingface';
      const fallbackKeyPresent =
        fallback === 'groq' ? !!process.env.GROQ_API_KEY : !!process.env.HUGGINGFACE_API_KEY;
      if (fallbackKeyPresent) {
        resultProvider = fallback;
        expandedIdea = await generateIdeaDraftWithProvider(
          fallback, idea, { targetMinutes: 10 },
          fallback === 'groq' ? groqErrorCapture : hfErrorCapture
        );
      }
    }

    if (!expandedIdea) {
      const detail = groqErrorCapture.message || hfErrorCapture.message;
      const classified = classifyProviderError(detail || 'Failed to generate script from the video transcript.');
      return sendApiError(
        res,
        502,
        classified.code,
        `Failed to generate script from the video transcript.${detail ? ` Details: ${detail}` : ''}`,
        classified.userMessage
      );
    }

    const result = buildIdeaScriptDraft(idea, { targetMinutes: 10 }, expandedIdea, resultProvider);
    res.json(result);
  });


  // ===== SECTION VALIDATION ENDPOINT =====
  app.post("/api/validate-sections", validateSections, (req, res) => {
    res.json({ message: "Sections are valid." });
  });

  // ===== NEW CONTENT PROCESSING ENDPOINTS =====

  /**
   * Process YouTube Transcript
   * Input: YouTube transcript (obtained separately)
   * Output: Full content package with chapters, summary, SEO, captions
   */
  app.post("/api/process/youtube-transcript", async (req, res) => {
    try {
      const { transcript, subject } = req.body;

      if (!transcript || typeof transcript !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'Transcript is required', 'Please paste a transcript before continuing.');
      }

      const transcriptLengthError = enforceMaxLength(
        res,
        transcript,
        'Transcript',
        MAX_TRANSCRIPT_LENGTH,
        'That transcript is too large to process in one request. Split it into smaller parts and try again.'
      );
      if (transcriptLengthError) {
        return transcriptLengthError;
      }

      const subjectLengthError = enforceMaxLength(
        res,
        subject,
        'Subject',
        MAX_SUBJECT_LENGTH,
        'Keep the subject shorter so the request stays within the allowed limit.'
      );
      if (subjectLengthError) {
        return subjectLengthError;
      }

      const result = processContent({
        type: 'youtube',
        data: {
          transcript,
          subject: subject || 'Video Content'
        }
      });

      res.json(result);
    } catch (error) {
      console.error('YouTube processing error:', error);
      res.status(500).json({
        code: 'processing_failed',
        error: 'Failed to process YouTube transcript',
        userMessage: 'We could not process that transcript right now. Please try again in a moment.',
      });
    }
  });

  /**
   * Process User-Uploaded Script
   * Input: Text script
   * Output: Chapters, summary, SEO, captions (no transcription needed)
   */
  app.post("/api/process/script", async (req, res) => {
    try {
      const { script, subject } = req.body;

      if (!script || typeof script !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'Script is required', 'Please paste a script before continuing.');
      }

      const scriptLengthError = enforceMaxLength(
        res,
        script,
        'Script',
        MAX_SCRIPT_LENGTH,
        'That script is too large to process in one request. Split it into smaller parts and try again.'
      );
      if (scriptLengthError) {
        return scriptLengthError;
      }

      const subjectLengthError = enforceMaxLength(
        res,
        subject,
        'Subject',
        MAX_SUBJECT_LENGTH,
        'Keep the subject shorter so the request stays within the allowed limit.'
      );
      if (subjectLengthError) {
        return subjectLengthError;
      }

      const result = processContent({
        type: 'script',
        data: {
          script,
          subject: subject || 'Video Content'
        }
      });

      res.json(result);
    } catch (error) {
      console.error('Script processing error:', error);
      res.status(500).json({
        code: 'processing_failed',
        error: 'Failed to process script',
        userMessage: 'We could not process that script right now. Please try again in a moment.',
      });
    }
  });

  app.post("/api/process/idea-draft", aiGenerationLimiter, async (req, res) => {
    try {
      const { idea, platform, sections } = req.body as IdeaDraftRequestBody;

      if (!idea || typeof idea !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'Idea is required', 'Please enter an idea before generating a draft.');
      }

      const ideaLengthError = enforceMaxLength(
        res,
        idea,
        'Idea',
        MAX_IDEA_LENGTH,
        'Keep the idea shorter so the request can be processed safely.'
      );
      if (ideaLengthError) {
        return ideaLengthError;
      }

      const sectionLengthError = validateIdeaDraftSections(res, sections);
      if (sectionLengthError) {
        return sectionLengthError;
      }

      const provider = getAvailableIdeaDraftProvider();
      if (!provider) {
        return sendApiError(
          res,
          503,
          'missing_configuration',
          'Missing AI API key. Set GEMINI_API_KEY or HUGGINGFACE_API_KEY in your environment or .env, then restart the server.',
          'The AI service is not configured yet. Add an API key, then try again.'
        );
      }

      const groqErrorCapture: { message: string } = { message: '' };
      const hfErrorCapture: { message: string } = { message: '' };

      let resultProvider: 'groq' | 'huggingface' = provider;

      // Try primary provider first
      let expandedIdea = await generateIdeaDraftWithProvider(provider, idea, sections,
        provider === 'groq' ? groqErrorCapture : hfErrorCapture,
        platform
      );

      // Fallback to the other provider if primary failed
      if (!expandedIdea) {
        const fallback: 'groq' | 'huggingface' = provider === 'huggingface' ? 'groq' : 'huggingface';
        const fallbackKeyPresent = fallback === 'groq' ? !!process.env.GROQ_API_KEY : !!process.env.HUGGINGFACE_API_KEY;

        if (fallbackKeyPresent) {
          resultProvider = fallback;
          expandedIdea = await generateIdeaDraftWithProvider(fallback, idea, sections,
            fallback === 'groq' ? groqErrorCapture : hfErrorCapture,
            platform
          );
        }
      }

      // Surface a clear 402 message if HF credits are exhausted
      if (!expandedIdea && hfErrorCapture.message.includes('402')) {
        const groqNote = groqErrorCapture.message
          ? ` Groq also failed: ${groqErrorCapture.message}.`
          : '';
        return sendApiError(
          res,
          502,
          'quota_exceeded',
          `HuggingFace credits exhausted (402).${groqNote} Please check your HuggingFace account or set GROQ_API_KEY.`,
          'This AI provider has used up its credits for now. Please come back later or switch to another provider.'
        );
      }

      // For TikTok, strip the YouTube-structured section content so it doesn't
      // override the freshly-parsed Hook/Value/CTA sections from the AI output.
      const sectionsForDraft = platform === 'tiktok'
        ? { targetMinutes: sections?.targetMinutes }
        : sections;

      const result = buildIdeaScriptDraft(
        idea,
        sectionsForDraft,
        expandedIdea ?? undefined,
        expandedIdea ? resultProvider : provider
      );

      if (!expandedIdea) {
        const primaryError = groqErrorCapture.message || hfErrorCapture.message;
        const detail = primaryError
          ? ` Details: ${primaryError}`
          : ' Verify the API key and model access, then restart the server.';
        const classified = classifyProviderError(primaryError || `Failed to generate an idea draft using ${provider}.`);
        return sendApiError(
          res,
          502,
          classified.code,
          `Failed to generate an idea draft using ${provider}.${detail}`,
          classified.userMessage
        );
      }

      res.json(result);
    } catch (error) {
      console.error('Idea draft processing error:', error);
      res.status(500).json({
        code: 'processing_failed',
        error: 'Failed to generate idea draft',
        userMessage: 'We hit a temporary problem while generating your draft. Please try again in a moment.',
      });
    }
  });

  /**
   * Process Idea into Full Video Package
   * Input: Subject idea + AI-generated script
   * Output: Complete package (script + transcript + chapters + summary + SEO + captions)
   */
  app.post("/api/process/idea", async (req, res) => {
    try {
      const { subject, script } = req.body;

      if (!subject || typeof subject !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'Subject is required', 'Please enter a subject before continuing.');
      }

      const subjectLengthError = enforceMaxLength(
        res,
        subject,
        'Subject',
        MAX_SUBJECT_LENGTH,
        'Keep the subject shorter so the request stays within the allowed limit.'
      );
      if (subjectLengthError) {
        return subjectLengthError;
      }

      if (!script || typeof script !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'Script is required (AI-generated)', 'Please generate a script before continuing.');
      }

      const scriptLengthError = enforceMaxLength(
        res,
        script,
        'Script',
        MAX_SCRIPT_LENGTH,
        'That script is too large to process in one request. Split it into smaller parts and try again.'
      );
      if (scriptLengthError) {
        return scriptLengthError;
      }

      // Add timestamps to script to create formatted transcript
      const transcript = addTimestampsToScript(script);

      const result = processContent({
        type: 'idea',
        data: {
          script: transcript,
          subject
        }
      });

      // Include original script in results
      const fullResult = {
        ...result,
        OriginalScript: script,
        Transcript: transcript
      };

      res.json(fullResult);
    } catch (error) {
      console.error('Idea processing error:', error);
      res.status(500).json({
        code: 'processing_failed',
        error: 'Failed to process idea',
        userMessage: 'We could not finish processing that idea right now. Please try again in a moment.',
      });
    }
  });

  // ✅ API Route for Groq AI (replaces Gemini)
  app.post("/api/groq", aiGenerationLimiter, async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
      return sendApiError(res, 400, 'invalid_input', 'Prompt is required', 'Please enter a prompt before continuing.');
    }

    const promptLengthError = enforceMaxLength(
      res,
      prompt,
      'Prompt',
      MAX_PROMPT_LENGTH,
      'Keep the prompt shorter so the AI request can be processed safely.'
    );
    if (promptLengthError) {
      return promptLengthError;
    }

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Groq API error:", error);
      res.status(500).json({
        code: 'provider_unavailable',
        error: 'Failed to connect to Groq API',
        userMessage: 'The AI service is busy right now. Please try again in a moment.',
      });
    }
  });

  // ✅ API Route for HuggingFace Image Generation (thumbnail creation)
  app.post("/api/generate-image", aiGenerationLimiter, async (req, res) => {
    const { prompt } = req.body;
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!prompt) {
      return sendApiError(res, 400, 'invalid_input', 'Prompt is required', 'Please enter a prompt before continuing.');
    }

    const promptLengthError = enforceMaxLength(
      res,
      prompt,
      'Prompt',
      MAX_PROMPT_LENGTH,
      'Keep the prompt shorter so the image request can be processed safely.'
    );
    if (promptLengthError) {
      return promptLengthError;
    }

    if (!apiKey) {
      return sendApiError(
        res,
        503,
        'missing_configuration',
        'Image generation not configured. Set HUGGINGFACE_API_KEY.',
        'Image generation is not configured yet. Add an API key, then try again.'
      );
    }

    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: `YouTube thumbnail: ${prompt}. Vibrant colors, engaging composition, professional quality.`,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("HuggingFace image error:", errText);
        const classified = classifyProviderError(errText);
        return sendApiError(
          res,
          502,
          classified.code,
          `Image generation failed: ${errText.slice(0, 200)}`,
          classified.userMessage
        );
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      res.json({ imageUrl: `data:image/jpeg;base64,${base64}` });
    } catch (error) {
      console.error("Image generation error:", error);
      res.status(500).json({
        code: 'processing_failed',
        error: 'Failed to generate image',
        userMessage: 'We could not generate that image right now. Please try again in a moment.',
      });
    }
  });

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  try {
    const { server: httpServer, port } = await listenWithFallback(app, PORT, 20);
    if (port !== PORT) {
      console.warn(`Port ${PORT} is in use. Server bound to fallback port ${port}.`);
    }
    console.log(`Server running on http://localhost:${port}`);

    // Vite middleware — created after listen so HMR WebSocket attaches to the HTTP server
    if (process.env.NODE_ENV !== "production") {
      const viteLogger = createLogger();
      const originalError = viteLogger.error;
      viteLogger.error = (msg, options) => {
        if (typeof msg === 'string' && msg.includes('WebSocket server error: Port 24678 is already in use')) {
          return;
        }
        originalError(msg, options);
      };

      const vite = await createViteServer({
        customLogger: viteLogger,
        server: {
          middlewareMode: true,
          hmr: {
            server: httpServer,
          },
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    }
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();
