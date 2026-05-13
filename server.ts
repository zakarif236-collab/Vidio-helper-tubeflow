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
import { applicationDefault, cert, getApps as getAdminApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore as getAdminFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage as getAdminStorage } from "firebase-admin/storage";

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

interface PatternApplicationRequestBody {
  patternScript?: string;
  userScript?: string;
  targetMinutes?: number;
  apiKey?: string;
}

interface ThumbnailAssistantRequestBody {
  provider?: 'groq' | 'gemini';
  userMessage?: string;
  systemPrompt?: string;
  apiKey?: string;
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

type IdeaDraftProvider = 'groq' | 'huggingface' | 'gemini';
type StructuredGenerationProvider = 'groq' | 'huggingface';

const DEFAULT_IDEA_DRAFT_PROVIDER_ORDER: IdeaDraftProvider[] = ['gemini', 'groq', 'huggingface'];
const DEFAULT_STRUCTURED_PROVIDER_ORDER: StructuredGenerationProvider[] = ['groq', 'huggingface'];

function parseProviderOrder<TProvider extends string>(
  rawValue: string | undefined,
  allowedProviders: readonly TProvider[],
  fallbackOrder: readonly TProvider[]
): TProvider[] {
  if (!rawValue?.trim()) {
    return [...fallbackOrder];
  }

  const allowedSet = new Set<TProvider>(allowedProviders);
  const configuredProviders = rawValue
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is TProvider => allowedSet.has(provider as TProvider));

  if (configuredProviders.length === 0) {
    return [...fallbackOrder];
  }

  return Array.from(new Set(configuredProviders));
}

function hasIdeaDraftProviderConfigured(provider: IdeaDraftProvider): boolean {
  if (provider === 'groq') {
    return !!process.env.GROQ_API_KEY;
  }

  if (provider === 'huggingface') {
    return !!process.env.HUGGINGFACE_API_KEY;
  }

  return !!process.env.GEMINI_DRAFT_API_KEY;
}

function hasStructuredGenerationProviderConfigured(provider: StructuredGenerationProvider): boolean {
  return provider === 'groq' ? !!process.env.GROQ_API_KEY : !!process.env.HUGGINGFACE_API_KEY;
}

function getIdeaDraftProviderOrder(): IdeaDraftProvider[] {
  return parseProviderOrder(
    process.env.TUBEFLOW_IDEA_PROVIDER_ORDER,
    DEFAULT_IDEA_DRAFT_PROVIDER_ORDER,
    DEFAULT_IDEA_DRAFT_PROVIDER_ORDER
  );
}

function getStructuredGenerationProviderOrder(): StructuredGenerationProvider[] {
  return parseProviderOrder(
    process.env.TUBEFLOW_STRUCTURED_PROVIDER_ORDER,
    DEFAULT_STRUCTURED_PROVIDER_ORDER,
    DEFAULT_STRUCTURED_PROVIDER_ORDER
  );
}

function getAvailableIdeaDraftProvider(): IdeaDraftProvider | null {
  return getIdeaDraftProviderOrder().find((provider) => hasIdeaDraftProviderConfigured(provider)) ?? null;
}

function getFallbackIdeaDraftProviders(primaryProvider: IdeaDraftProvider): IdeaDraftProvider[] {
  return getIdeaDraftProviderOrder().filter((provider) => provider !== primaryProvider && hasIdeaDraftProviderConfigured(provider));
}

function getAvailableStructuredGenerationProvider(): StructuredGenerationProvider | null {
  return getStructuredGenerationProviderOrder().find((provider) => hasStructuredGenerationProviderConfigured(provider)) ?? null;
}

function getFallbackStructuredGenerationProviders(primaryProvider: StructuredGenerationProvider): StructuredGenerationProvider[] {
  return getStructuredGenerationProviderOrder().filter((provider) => provider !== primaryProvider && hasStructuredGenerationProviderConfigured(provider));
}

function getIdeaDraftProviderLabel(provider: IdeaDraftProvider | null): string {
  if (provider === 'groq') {
    return 'Groq (Llama 3.3)';
  }

  if (provider === 'huggingface') {
    return 'Hugging Face';
  }

  if (provider === 'gemini') {
    return 'Gemini (Flash)';
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
  const introMins = Math.round(targetMinutes * 0.1);
  const devMins = Math.round(targetMinutes * 0.35);
  const climaxMins = Math.round(targetMinutes * 0.35);
  const resMins = targetMinutes - introMins - devMins - climaxMins;

  return [
    'You are a world-class YouTube scriptwriter. Your scripts have driven millions of views for top creators.',
    `Write a full, publish-ready spoken script for a ${targetMinutes}-minute YouTube video.`,
    `Total word target: ${targetWords} words. Minimum: ${minimumWords} words. Do not stop early.`,
    '',
    'STRUCTURE — use these exact headings on their own lines, nothing else:',
    '',
    `Initial Concept (${introductionWordRange.min}–${introductionWordRange.max} words, ~${introMins} min)`,
    'GOAL: Hook so strong the viewer cannot click away. Open with a bold claim, shocking stat, relatable failure, or a question that creates instant tension.',
    'RULES: Never open with "In this video I will..." — that kills retention. Instead: start with the conflict, the payoff, or the surprise. End this section with a clear promise of what the viewer will gain.',
    '',
    `Develop Story (${developmentWordRange.min}–${developmentWordRange.max} words, ~${devMins} min)`,
    'GOAL: Deliver specific, high-value content. Use 3–4 concrete examples, real stories, step-by-step breakdowns, or dialogue beats. Every beat must earn the viewer\'s continued attention.',
    'RULES: Use open loops ("I\'ll show you exactly why in a moment...") to hold attention across beats. Add [B-ROLL: <short description>] inline cues at 2–3 natural moments. Use specific numbers and details — vague claims lose viewers.',
    '',
    `Key Moment (${climaxWordRange.min}–${climaxWordRange.max} words, ~${climaxMins} min)`,
    'GOAL: The biggest payoff. The insight that reframes everything, the unexpected twist, or the emotional peak that makes this video worth sharing.',
    'RULES: This is the "reason you watched" moment. Use a contrarian take, a surprising reveal, or a "the thing nobody tells you about..." beat. Include a mid-video retention hook before this section if the previous section ran long.',
    '',
    `Wrap Up (${resolutionWordRange.min}–${resolutionWordRange.max} words, ~${resMins} min)`,
    'GOAL: Lock in the takeaway, give one concrete next action, close any open loops, and deliver the CTA.',
    'RULES: Callback to the hook from the opening. Make the CTA feel like a natural next step, not a transaction. End on a line that lands — a final truth, a reframe, or a motivational close.',
    '',
    'QUALITY RULES FOR THE FULL SCRIPT:',
    '- Write in second person ("you") throughout — make it feel personal to one viewer.',
    '- Mix sentence length: short punchy sentences for impact, longer ones to build context.',
    '- Every single sentence must earn its place. Cut anything vague, filler, or slow.',
    '- Weave in the topic\'s key terms naturally 3–5 times for SEO memorability.',
    '- Write how a skilled presenter actually talks — contractions, direct questions, natural pauses.',
    '- Do NOT use markdown, bullet lists, bold, or headers inside the script.',
    '- Use the exact four headings above. Return plain spoken text only.',
    '',
    `Subject: ${idea}`,
    `Initial Concept notes: ${sections?.introduction || 'none provided'}`,
    `Develop Story notes: ${sections?.development || 'none provided'}`,
    `Key Moment notes: ${sections?.climax || 'none provided'}`,
    `Wrap Up notes: ${sections?.resolution || 'none provided'}`,
    retryOptions
      ? `IMPORTANT: The previous attempt was only ${retryOptions.previousWordCount} words. Expand every section significantly. Hit at least ${targetWords} words — do not summarize, do not skip beats, keep building.`
      : '',
    retryOptions?.existingDraft
      ? ['Previous draft to expand:\n', retryOptions.existingDraft].join('\n')
      : '',
  ].filter(Boolean).join('\n');
}

function buildSEOPrompt(idea: string, draft: string): string {
  const draftExcerpt = draft.slice(0, 3000);
  return [
    'You are a YouTube SEO expert. Based on the idea and script excerpt below, generate a complete SEO package.',
    'Return ONLY a valid JSON object with this exact structure, no other text:',
    '{',
    '  "titles": ["title1", "title2", "title3"],',
    '  "description": "full YouTube description here",',
    '  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],',
    '  "thumbnailConcepts": ["concept1", "concept2"]',
    '}',
    '',
    'Rules for titles: 3 options, each under 70 characters. First must use a number or power word. Second must tease a reveal or secret. Third must be curiosity-gap or contrarian.',
    'Rules for description: Start with 2 hook sentences (most important for SEO). Then list 3-5 key points covered. Then a CTA. Then 3-5 hashtags at the end. Max 500 characters.',
    'Rules for tags: 10 specific tags mixing broad and niche terms. Include the topic, related subtopics, and audience intent terms.',
    'Rules for thumbnailConcepts: 2 short descriptions of high-CTR thumbnail compositions.',
    '',
    `Video idea: ${idea}`,
    'Script excerpt:',
    draftExcerpt,
  ].join('\n');
}

function buildUrlPatternAnalysisPrompt(title: string, transcript: string): string {
  const transcriptExcerpt = getYouTubeTranscriptPromptExcerpt(transcript, 10000);
  return [
    'You are an expert YouTube content strategist and scriptwriting coach.',
    'Analyze this transcript and extract the creator\'s exact scriptwriting formula.',
    'Return ONLY a valid JSON object with this exact structure, no other text:',
    '{',
    '  "hookFormula": "describe exactly how the first 30-60 seconds works",',
    '  "retentionLoops": ["technique1", "technique2", "technique3"],',
    '  "transitionPhrases": ["phrase1", "phrase2", "phrase3"],',
    '  "exampleStructure": "how they set up and deliver examples",',
    '  "ctaStyle": "how they ask for likes/subscribes/next actions",',
    '  "pacingBlueprint": "sentence rhythm, pacing patterns, emphasis style",',
    '  "keywordStrategy": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],',
    '  "powerWords": ["word1", "word2", "word3", "word4", "word5"],',
    '  "styleProfile": "2-3 sentence summary of the creator\'s complete style formula",',
    '  "applicableTemplate": "write the opening 3-4 sentences using this creator\'s exact hook formula, applied to a new topic"',
    '}',
    '',
    `Title: ${title}`,
    'Transcript:',
    transcriptExcerpt,
  ].join('\n');
}

function getYouTubeTranscriptPromptExcerpt(transcript: string, maxChars = 12_000): string {
  const normalizedTranscript = transcript.replace(/\s+/g, ' ').trim();

  if (normalizedTranscript.length <= maxChars) {
    return normalizedTranscript;
  }

  const clipped = normalizedTranscript.slice(0, maxChars);
  const sentenceBoundary = Math.max(
    clipped.lastIndexOf('. '),
    clipped.lastIndexOf('! '),
    clipped.lastIndexOf('? ')
  );
  const safeEnd = sentenceBoundary > Math.floor(maxChars * 0.7) ? sentenceBoundary + 1 : clipped.length;

  return `${clipped.slice(0, safeEnd).trim()}\n\n[Transcript truncated for prompt length.]`;
}

function buildYouTubeTranscriptLearningPrompt(title: string, transcript: string): string {
  const transcriptExcerpt = getYouTubeTranscriptPromptExcerpt(transcript);

  return [
    'Study this transcript as a source pattern.',
    '',
    'Do not copy unique sentences verbatim.',
    'Instead, extract and apply:',
    '- the hook structure',
    '- recurring terminology',
    '- pacing and sentence rhythm',
    '- how punchlines are delivered',
    '- how examples are introduced',
    '- how sections transition',
    '- how the ending and CTA are framed',
    '',
    'Return plain text only in exactly this layout:',
    '',
    'STYLE PROFILE',
    'Hook structure: describe the opening pattern.',
    'Recurring terminology: list the important repeated words, phrases, or framing terms.',
    'Pacing and sentence rhythm: describe sentence length, flow, and emphasis style.',
    'Punchline delivery: explain how punchlines or sharp lines land.',
    'Example introduction pattern: explain how examples are set up and developed.',
    'Section transition pattern: explain how one beat moves to the next.',
    'Ending and CTA framing: explain how the script closes and what kind of CTA it uses.',
    '',
    'NEW SCRIPT',
    'Initial Concept',
    '(Write the opening using the learned hook structure and tone. Do not quote the source.)',
    '',
    'Develop Story',
    '(Write the body using the learned terminology, rhythm, example pattern, and transitions. Do not quote the source.)',
    '',
    'Key Moment',
    '(Write the strongest insight or emotional turn using the learned punchline style. Do not quote the source.)',
    '',
    'Wrap Up',
    '(Close using the learned ending and CTA framing. Do not quote the source.)',
    '',
    'Rules for NEW SCRIPT:',
    '- Use the exact headings: Initial Concept, Develop Story, Key Moment, Wrap Up.',
    '- Write in natural spoken language.',
    '- Keep the structure and rhetorical patterns from the source, but make the wording newly generated.',
    '- Never copy distinctive sentences from the transcript.',
    '- No markdown, no bullet lists, no bold formatting in NEW SCRIPT.',
    '',
    `Title: ${title}`,
    'Transcript:',
    transcriptExcerpt,
  ].join('\n');
}

function getPatternApplicationMaxTokens(totalMinutes: number | undefined, provider: 'groq' | 'huggingface'): number {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);

  if (provider === 'groq') {
    if (normalizedMinutes === 20) {
      return 4800;
    }
    if (normalizedMinutes === 15) {
      return 3600;
    }
    if (normalizedMinutes === 10) {
      return 2800;
    }
    return 2200;
  }

  if (normalizedMinutes === 20) {
    return 4200;
  }
  if (normalizedMinutes === 15) {
    return 3200;
  }
  if (normalizedMinutes === 10) {
    return 2400;
  }
  return 1800;
}

function buildPatternApplicationPrompt(patternScript: string, userScript: string, targetMinutes: number | undefined): string {
  const patternExcerpt = getYouTubeTranscriptPromptExcerpt(patternScript, 8_000);
  const userScriptExcerpt = getYouTubeTranscriptPromptExcerpt(userScript, 8_000);
  const normalizedMinutes = normalizeTargetMinutes(targetMinutes);
  const targetWords = getTargetWordCount(normalizedMinutes);

  return [
    'Study the first script as a source pattern, then rewrite the second script using that pattern logic.',
    `Target the final output for a ${normalizedMinutes}-minute YouTube script at roughly ${targetWords} words.`,
    '',
    'Do not paste the pattern into the user script.',
    'Do not copy distinctive sentences from the pattern verbatim.',
    'Preserve the user script\'s subject, core facts, named entities, and overall meaning.',
    'Improve the user script by borrowing the pattern\'s rhetorical logic only.',
    '',
    'Extract and apply these elements from the pattern:',
    '- hook structure',
    '- recurring terminology or framing words',
    '- pacing and sentence rhythm',
    '- how examples are introduced',
    '- transition style between beats',
    '- how the ending and CTA are framed',
    '',
    'Rewrite rules:',
    '- Keep the improved script focused on the user script\'s story, not the pattern\'s original topic.',
    `- Expand or condense the script so it feels appropriately paced for ${normalizedMinutes} minutes.`,
    '- Strengthen weak transitions and add connective phrasing where needed.',
    '- Reuse recurring framing terms only when they fit naturally.',
    '- If the user script lacks a concrete example, add a short believable illustrative moment that matches the story.',
    '- End with a stronger callback or CTA that fits the user script.',
    '- Return plain text only.',
    '- Do not use headings, bullet points, markdown, or analysis.',
    '',
    'PATTERN SCRIPT:',
    patternExcerpt,
    '',
    'USER SCRIPT TO IMPROVE:',
    userScriptExcerpt,
  ].join('\n');
}

const PATTERN_FALLBACK_STOP_WORDS = new Set([
  'about', 'after', 'again', 'almost', 'along', 'also', 'always', 'around', 'because', 'before', 'being', 'begins',
  'between', 'could', 'every', 'first', 'from', 'grows', 'here', 'into', 'just', 'longer', 'might', 'other',
  'over', 'same', 'short', 'should', 'still', 'story', 'their', 'there', 'these', 'thing', 'through', 'under',
  'until', 'using', 'value', 'where', 'which', 'while', 'without', 'would', 'your', 'journey', 'example',
  'transition', 'ending', 'hook', 'body', 'rhythm', 'cta', 'script', 'pattern'
]);

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean)
    ?? [];
}

function ensureSentence(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function stripOuterQuotes(text: string): string {
  return text.trim().replace(/^['"“”]+|['"“”]+$/g, '').trim();
}

function parsePatternBlocks(patternScript: string): Record<string, string> {
  const labels = ['Hook', 'Body Rhythm', 'Short burst', 'Longer line', 'Example', 'Transition', 'Ending CTA', 'Initial Concept', 'Develop Story', 'Key Moment', 'Wrap Up'];
  const parsed: Record<string, string[]> = {};
  let currentLabel: string | null = null;

  patternScript
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line) {
        return;
      }

      const nextLabel = labels.find((label) => line.toLowerCase().startsWith(label.toLowerCase()));
      if (nextLabel) {
        currentLabel = nextLabel;
        const remainder = line.slice(nextLabel.length).replace(/^\s*:\s*/, '').trim();
        if (!parsed[currentLabel]) {
          parsed[currentLabel] = [];
        }
        if (remainder) {
          parsed[currentLabel].push(remainder);
        }
        return;
      }

      if (currentLabel) {
        parsed[currentLabel].push(line);
      }
    });

  return Object.fromEntries(
    Object.entries(parsed)
      .map(([label, lines]) => [label, lines.join(' ').trim()])
      .filter(([, value]) => Boolean(value))
  );
}

function extractDominantPatternTerm(patternScript: string): string | null {
  const words = patternScript.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [];
  const counts = new Map<string, number>();

  words.forEach((word) => {
    if (PATTERN_FALLBACK_STOP_WORDS.has(word)) {
      return;
    }
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });

  const [topWord, topCount] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return topWord && typeof topCount === 'number' && topCount > 1 ? topWord : null;
}

function buildFallbackPatternAppliedScript(patternScript: string, userScript: string, targetMinutes?: number): string {
  const blocks = parsePatternBlocks(patternScript);
  const userSentences = splitSentences(userScript);
  const opening = ensureSentence(userSentences[0] || userScript);
  const continuation = ensureSentence(userSentences.slice(1).join(' '));
  const dominantTerm = extractDominantPatternTerm(patternScript);
  const transition = ensureSentence(stripOuterQuotes(blocks.Transition || 'But here is the twist'));
  const endingCta = ensureSentence(stripOuterQuotes(blocks['Ending CTA'] || blocks['Wrap Up'] || 'Keep shaping it until the story becomes stronger'));
  const exampleSeed = ensureSentence(stripOuterQuotes(userSentences[1] || userSentences[0] || userScript));
  const normalizedMinutes = normalizeTargetMinutes(targetMinutes);

  const improvedSentences = [
    opening,
    dominantTerm
      ? ensureSentence(`That was the ${dominantTerm} inside the story, the first sign that this journey could become something larger`)
      : ensureSentence('That opening gives the story a stronger center, but a strong beginning still needs rhythm and direction'),
    continuation,
    ensureSentence(`Keep the pacing shaped for a ${normalizedMinutes}-minute YouTube script so each beat has room to land without dragging`),
    dominantTerm
      ? ensureSentence(`A ${dominantTerm} can start the motion, but without pressure, proof, and purpose it fades before the story fully lands`)
      : ensureSentence('Momentum matters because effort alone is not enough to make a story feel complete'),
    ensureSentence(`Imagine this moment in real life: ${exampleSeed.replace(/[.!?]+$/g, '')}. That is where the story stops sounding general and starts feeling real`),
    transition,
    ensureSentence('The real shift comes when the character moves from effort into intention, turning scattered action into a direction people can actually follow'),
    ensureSentence(`That is the takeaway. ${endingCta.replace(/[.!?]+$/g, '')}`),
  ].filter(Boolean);

  return improvedSentences.join(' ');
}

function extractYouTubeStyleProfile(text: string): string | null {
  const match = text.match(/STYLE PROFILE\s*([\s\S]*?)\s*NEW SCRIPT\s*/i);
  const profile = match?.[1]?.trim();
  return profile ? profile : null;
}

function extractYouTubeScript(text: string): string {
  const match = text.match(/NEW SCRIPT\s*([\s\S]*)$/i);
  return (match?.[1] || text).trim();
}

async function generateYouTubeStyleDraftWithProvider(
  provider: 'groq' | 'huggingface',
  title: string,
  transcript: string,
  errorCapture?: { message: string }
): Promise<{ script: string; styleProfile: string | null } | null> {
  const prompt = buildYouTubeTranscriptLearningPrompt(title, transcript);

  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return null;
    }

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
          max_tokens: 3500,
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
        if (errorCapture) {
          errorCapture.message = `Groq error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
        }
        return null;
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content?.trim();
      if (!rawText) {
        return null;
      }

      return {
        script: normalizeGeneratedIdeaDraft(extractYouTubeScript(rawText)),
        styleProfile: extractYouTubeStyleProfile(rawText),
      };
    } catch (error) {
      console.warn('Groq YouTube style generation request failed:', error);
      return null;
    }
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        max_tokens: 2800,
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
      if (errorCapture) {
        errorCapture.message = `HuggingFace error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
      }
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const rawText = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content
            .map((part: { text?: string; type?: string }) => typeof part?.text === 'string' ? part.text : '')
            .join('')
            .trim()
        : '';

    if (!rawText) {
      return null;
    }

    return {
      script: normalizeGeneratedIdeaDraft(extractYouTubeScript(rawText)),
      styleProfile: extractYouTubeStyleProfile(rawText),
    };
  } catch (error) {
    console.warn('Hugging Face YouTube style generation request failed:', error);
    return null;
  }
}

async function generateYouTubeStyleDraftWithGemini(
  title: string,
  transcript: string,
  errorCapture?: { message: string }
): Promise<{ script: string; styleProfile: string | null } | null> {
  const apiKey = process.env.GEMINI_DRAFT_API_KEY;

  if (!apiKey) {
    return null;
  }

  const prompt = buildYouTubeTranscriptLearningPrompt(title, transcript);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 3500 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        detail = parsed?.error?.message || errorText;
      } catch {
        detail = errorText || detail;
      }
      if (errorCapture) {
        errorCapture.message = `Gemini error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
      }
      return null;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim();

    if (!rawText) {
      return null;
    }

    return {
      script: normalizeGeneratedIdeaDraft(extractYouTubeScript(rawText)),
      styleProfile: extractYouTubeStyleProfile(rawText),
    };
  } catch (error) {
    console.warn('Gemini YouTube style generation request failed:', error);
    return null;
  }
}

async function generatePatternAppliedScriptWithProvider(
  provider: 'groq' | 'huggingface',
  patternScript: string,
  userScript: string,
  targetMinutes: number | undefined,
  providerApiKey?: string,
  errorCapture?: { message: string }
): Promise<string | null> {
  const prompt = buildPatternApplicationPrompt(patternScript, userScript, targetMinutes);
  const maxTokens = getPatternApplicationMaxTokens(targetMinutes, provider);

  if (provider === 'groq') {
    const apiKey = providerApiKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return null;
    }

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
          max_tokens: maxTokens,
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
        if (errorCapture) {
          errorCapture.message = `Groq error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
        }
        return null;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === 'string' ? text.trim() || null : null;
    } catch (error) {
      console.warn('Groq pattern application request failed:', error);
      return null;
    }
  }

  const apiKey = providerApiKey || process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        max_tokens: maxTokens,
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
      if (errorCapture) {
        errorCapture.message = `HuggingFace error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
      }
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content.trim() || null;
    }

    if (Array.isArray(content)) {
      const joined = content
        .map((part: { text?: string; type?: string }) => typeof part?.text === 'string' ? part.text : '')
        .join('')
        .trim();

      return joined || null;
    }

    return null;
  } catch (error) {
    console.warn('Hugging Face pattern application request failed:', error);
    return null;
  }
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

async function expandIdeaWithGemini(
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  retryOptions?: { minimumWords: number; previousWordCount: number; existingDraft?: string },
  errorCapture?: { message: string },
  platform?: 'youtube' | 'tiktok'
): Promise<string | null> {
  const apiKey = process.env.GEMINI_DRAFT_API_KEY;

  if (!apiKey) {
    return null;
  }

  const prompt = buildIdeaDraftPrompt(idea, sections, retryOptions, platform);
  const maxTokens = platform === 'tiktok' ? 600 : normalizeTargetMinutes(sections?.targetMinutes) === 20 ? 6000 : normalizeTargetMinutes(sections?.targetMinutes) === 15 ? 4500 : 3500;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        detail = parsed?.error?.message || errorText;
      } catch {
        detail = errorText || detail;
      }
      console.warn(`Gemini idea expansion failed (${response.status}):`, detail);
      if (errorCapture) {
        errorCapture.message = `Gemini error (${response.status}): ${typeof detail === 'string' ? detail.slice(0, 200) : detail}`;
      }
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim();
    return text || null;
  } catch (error) {
    console.warn('Gemini idea expansion request failed:', error);
    return null;
  }
}

async function generateIdeaDraftWithProvider(
  provider: 'groq' | 'huggingface' | 'gemini',
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  providerErrorCapture?: { message: string },
  platform?: 'youtube' | 'tiktok'
): Promise<string | null> {
  // TikTok scripts are intentionally short — single attempt, no word-count retry.
  if (platform === 'tiktok') {
    const generatedDraft = provider === 'groq'
      ? await expandIdeaWithGroq(idea, sections, undefined, providerErrorCapture, 'tiktok')
      : provider === 'gemini'
        ? await expandIdeaWithGemini(idea, sections, undefined, providerErrorCapture, 'tiktok')
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
      : provider === 'gemini'
        ? await expandIdeaWithGemini(idea, sections, retryOptions, providerErrorCapture)
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

export interface ScriptSEOResult {
  titles: string[];
  description: string;
  tags: string[];
  thumbnailConcepts: string[];
}

async function generateScriptSEO(
  idea: string,
  draft: string,
  provider?: StructuredGenerationProvider
): Promise<ScriptSEOResult | null> {
  const resolvedProvider = provider ?? getAvailableStructuredGenerationProvider();
  if (!resolvedProvider) return null;

  const prompt = buildSEOPrompt(idea, draft);

  const callProvider = async (p: 'groq' | 'huggingface'): Promise<string | null> => {
    if (p === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return null;
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 800,
            response_format: { type: 'json_object' },
          }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim() ?? null;
      } catch { return null; }
    }
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    const model = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
    if (!apiKey) return null;
    try {
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 800,
          stream: false,
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content.trim() : null;
    } catch { return null; }
  };

  let raw = await callProvider(resolvedProvider);
  if (!raw) {
    const fallback: 'groq' | 'huggingface' = resolvedProvider === 'groq' ? 'huggingface' : 'groq';
    const fallbackKeyPresent = fallback === 'groq' ? !!process.env.GROQ_API_KEY : !!process.env.HUGGINGFACE_API_KEY;
    if (fallbackKeyPresent) raw = await callProvider(fallback);
  }

  if (!raw) return null;

  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return {
      titles: Array.isArray(parsed.titles) ? parsed.titles.filter((t: unknown) => typeof t === 'string').slice(0, 3) : [],
      description: typeof parsed.description === 'string' ? parsed.description : '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string').slice(0, 15) : [],
      thumbnailConcepts: Array.isArray(parsed.thumbnailConcepts) ? parsed.thumbnailConcepts.filter((t: unknown) => typeof t === 'string').slice(0, 2) : [],
    };
  } catch { return null; }
}

export interface UrlPatternAnalysisResult {
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
}

async function analyzeUrlAsPattern(
  title: string,
  transcript: string,
  provider?: StructuredGenerationProvider
): Promise<UrlPatternAnalysisResult | null> {
  const resolvedProvider = provider ?? getAvailableStructuredGenerationProvider();
  if (!resolvedProvider) return null;

  const prompt = buildUrlPatternAnalysisPrompt(title, transcript);

  const callProvider = async (p: 'groq' | 'huggingface'): Promise<string | null> => {
    if (p === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return null;
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1200,
            response_format: { type: 'json_object' },
          }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim() ?? null;
      } catch { return null; }
    }
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    const model = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
    if (!apiKey) return null;
    try {
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1200,
          stream: false,
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content.trim() : null;
    } catch { return null; }
  };

  let raw = await callProvider(resolvedProvider);
  if (!raw) {
    const fallback: 'groq' | 'huggingface' = resolvedProvider === 'groq' ? 'huggingface' : 'groq';
    const fallbackKeyPresent = fallback === 'groq' ? !!process.env.GROQ_API_KEY : !!process.env.HUGGINGFACE_API_KEY;
    if (fallbackKeyPresent) raw = await callProvider(fallback);
  }

  if (!raw) return null;

  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return {
      hookFormula: typeof parsed.hookFormula === 'string' ? parsed.hookFormula : '',
      retentionLoops: Array.isArray(parsed.retentionLoops) ? parsed.retentionLoops.filter((x: unknown) => typeof x === 'string').slice(0, 5) : [],
      transitionPhrases: Array.isArray(parsed.transitionPhrases) ? parsed.transitionPhrases.filter((x: unknown) => typeof x === 'string').slice(0, 6) : [],
      exampleStructure: typeof parsed.exampleStructure === 'string' ? parsed.exampleStructure : '',
      ctaStyle: typeof parsed.ctaStyle === 'string' ? parsed.ctaStyle : '',
      pacingBlueprint: typeof parsed.pacingBlueprint === 'string' ? parsed.pacingBlueprint : '',
      keywordStrategy: Array.isArray(parsed.keywordStrategy) ? parsed.keywordStrategy.filter((x: unknown) => typeof x === 'string').slice(0, 7) : [],
      powerWords: Array.isArray(parsed.powerWords) ? parsed.powerWords.filter((x: unknown) => typeof x === 'string').slice(0, 8) : [],
      styleProfile: typeof parsed.styleProfile === 'string' ? parsed.styleProfile : '',
      applicableTemplate: typeof parsed.applicableTemplate === 'string' ? parsed.applicableTemplate : '',
      sourceTitle: title,
    };
  } catch { return null; }
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
  | 'unauthorized'
  | 'guest_trial_used'
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

function getFirebaseProjectId(): string | null {
  return process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || null;
}

function getFirebaseStorageBucketName(): string | null {
  return process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || null;
}

function getFirebaseAdminApp() {
  const existingApp = getAdminApps().find((app) => app.name === 'tubeflow-admin');
  if (existingApp) {
    return existingApp;
  }

  const projectId = getFirebaseProjectId();
  if (!projectId) {
    throw new Error('Firebase Admin is missing FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.');
  }

  const storageBucket = getFirebaseStorageBucketName() ?? undefined;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    return initializeAdminApp(
      {
        credential: cert(JSON.parse(serviceAccountJson)),
        projectId,
        storageBucket,
      },
      'tubeflow-admin',
    );
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    return initializeAdminApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
        storageBucket,
      },
      'tubeflow-admin',
    );
  }

  return initializeAdminApp(
    {
      credential: applicationDefault(),
      projectId,
      storageBucket,
    },
    'tubeflow-admin',
  );
}

function getFirebaseAdminContext() {
  const app = getFirebaseAdminApp();
  return {
    auth: getAdminAuth(app),
    firestore: getAdminFirestore(app),
    storage: getAdminStorage(app),
  };
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function hasFirebaseAdminErrorCode(error: unknown, expectedCode: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && String((error as { code: unknown }).code).includes(expectedCode);
}

type UsageQuotaKind = 'idea' | 'draft' | 'thumbnail';

type AuthAccess = {
  decodedToken: DecodedIdToken | null;
};

class UsageQuotaExceededError extends Error {
  readonly kind: UsageQuotaKind;

  constructor(kind: UsageQuotaKind) {
    super(kind === 'idea'
      ? 'Your monthly idea generation quota has been reached.'
      : kind === 'draft'
        ? 'Your monthly AI draft quota has been reached.'
        : 'Your monthly thumbnail quota has been reached.');
    this.name = 'UsageQuotaExceededError';
    this.kind = kind;
  }
}

function getQuotaLimit(kind: UsageQuotaKind): number {
  const rawValue = kind === 'idea'
    ? process.env.TUBEFLOW_MONTHLY_IDEA_LIMIT
    : kind === 'draft'
      ? process.env.TUBEFLOW_MONTHLY_DRAFT_LIMIT
      : process.env.TUBEFLOW_MONTHLY_THUMBNAIL_LIMIT;
  const parsedValue = Number(rawValue);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return kind === 'idea' ? 40 : 120;
}

function getAuthUserMessage(error: unknown): string {
  if (hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')) {
    return 'Your session expired. Please refresh the page and try again.';
  }
  if (hasFirebaseAdminErrorCode(error, 'auth/user-disabled')) {
    return 'This account has been disabled. Contact support if you think this is a mistake.';
  }
  if (
    error instanceof Error && error.message.includes('Missing Firebase ID token')
  ) {
    return 'Please sign in to continue.';
  }
  return 'Your session is invalid. Please sign out and sign back in.';
}

async function requireAuthenticatedUser(req: Request): Promise<DecodedIdToken> {
  const idToken = readBearerToken(req);
  if (!idToken) {
    throw new Error('Missing Firebase ID token.');
  }

  const { auth } = getFirebaseAdminContext();
  return auth.verifyIdToken(idToken);
}

async function requireAuthenticatedUserOrGuestTrial(req: Request, kind: UsageQuotaKind): Promise<AuthAccess> {
  const idToken = readBearerToken(req);

  if (idToken) {
    const { auth } = getFirebaseAdminContext();
    const decodedToken = await auth.verifyIdToken(idToken);
    await consumeUserQuota(decodedToken, kind);
    return {
      decodedToken,
    };
  }

  return {
    decodedToken: null,
  };
}

async function consumeUserQuota(decodedToken: DecodedIdToken, kind: UsageQuotaKind): Promise<void> {
  const { firestore } = getFirebaseAdminContext();
  const userRef = firestore.doc(`users/${decodedToken.uid}`);
  const now = new Date();
  const monthlyLimit = getQuotaLimit(kind);

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const data = snapshot.exists ? snapshot.data() as Record<string, any> : {};
    const quota = typeof data.quota === 'object' && data.quota !== null ? data.quota : {};

    const resetAt = quota.resetAt instanceof Timestamp
      ? quota.resetAt.toDate()
      : quota.resetAt?.toDate?.() instanceof Date
        ? quota.resetAt.toDate()
        : null;

    const shouldResetCounters = !resetAt
      || resetAt.getUTCFullYear() !== now.getUTCFullYear()
      || resetAt.getUTCMonth() !== now.getUTCMonth();

    const ideasThisMonth = shouldResetCounters ? 0 : Number(quota.ideasThisMonth) || 0;
    const draftsThisMonth = shouldResetCounters ? 0 : Number(quota.draftsThisMonth) || 0;
    const thumbnailsThisMonth = shouldResetCounters ? 0 : Number(quota.thumbnailsThisMonth) || 0;

    if (kind === 'idea' && ideasThisMonth >= monthlyLimit) {
      throw new UsageQuotaExceededError(kind);
    }

    if (kind === 'draft' && draftsThisMonth >= monthlyLimit) {
      throw new UsageQuotaExceededError(kind);
    }

    if (kind === 'thumbnail' && thumbnailsThisMonth >= monthlyLimit) {
      throw new UsageQuotaExceededError(kind);
    }

    transaction.set(userRef, {
      uid: decodedToken.uid,
      email: decodedToken.email ?? data.email ?? '',
      displayName: decodedToken.name ?? data.displayName ?? 'TubeFlow User',
      quota: {
        ideasThisMonth: kind === 'idea' ? ideasThisMonth + 1 : ideasThisMonth,
        draftsThisMonth: kind === 'draft' ? draftsThisMonth + 1 : draftsThisMonth,
        thumbnailsThisMonth: kind === 'thumbnail' ? thumbnailsThisMonth + 1 : thumbnailsThisMonth,
        resetAt: Timestamp.fromDate(now),
      },
    }, { merge: true });
  });
}

function isQuotaExceededError(error: unknown): error is UsageQuotaExceededError {
  return error instanceof UsageQuotaExceededError;
}

function getQuotaExceededUserMessage(kind: UsageQuotaKind): string {
  return kind === 'idea'
    ? 'You\'ve hit today\'s idea generation limit. Come back tomorrow for more credits.'
    : kind === 'draft'
      ? 'You\'ve hit today\'s AI draft limit. Come back tomorrow for more credits.'
      : 'You\'ve hit today\'s thumbnail limit. Come back tomorrow for more credits.';
}

async function deleteCollectionDocuments(firestore: Firestore, collectionPath: string): Promise<void> {
  const snapshot = await firestore.collection(collectionPath).get();
  if (snapshot.empty) {
    return;
  }

  const batchSize = 400;
  for (let index = 0; index < snapshot.docs.length; index += batchSize) {
    const batch = firestore.batch();
    snapshot.docs.slice(index, index + batchSize).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function deleteAndDisableFirebaseAccount(decodedToken: DecodedIdToken): Promise<void> {
  const { auth, firestore, storage } = getFirebaseAdminContext();
  const userRecord = await auth.getUser(decodedToken.uid);
  const disabledUserRef = firestore.doc(`disabledUsers/${decodedToken.uid}`);

  await disabledUserRef.set(
    {
      uid: decodedToken.uid,
      email: userRecord.email ?? decodedToken.email ?? '',
      displayName: userRecord.displayName ?? decodedToken.name ?? 'TubeFlow User',
      authRetention: 'firebase-auth-retained',
      status: 'deleting',
      disabledAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await auth.updateUser(decodedToken.uid, { disabled: true });
  await auth.revokeRefreshTokens(decodedToken.uid);
  await deleteCollectionDocuments(firestore, `users/${decodedToken.uid}/projects`);
  await firestore.doc(`users/${decodedToken.uid}`).delete();
  await storage.bucket().file(`avatars/${decodedToken.uid}`).delete({ ignoreNotFound: true });

  await disabledUserRef.set(
    {
      status: 'disabled',
      dataPurgedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function executeThumbnailAssistantRequest(
  provider: 'groq' | 'gemini',
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  if (provider === 'gemini') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nUser request: ${userMessage}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Gemini request failed with status ${response.status}.`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Groq request failed with status ${response.status}.`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
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
      userMessage: 'You\'ve hit today\'s usage limit. Come back tomorrow for more credits, or switch to another provider.',
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

  app.post('/api/account/delete', async (req, res) => {
    const idToken = readBearerToken(req);
    if (!idToken) {
      return sendApiError(
        res,
        401,
        'unauthorized',
        'Missing Firebase ID token.',
        'Sign in again before deleting your account data.',
      );
    }

    try {
      const { auth } = getFirebaseAdminContext();
      const decodedToken = await auth.verifyIdToken(idToken);
      await deleteAndDisableFirebaseAccount(decodedToken);
      return res.json({ ok: true });
    } catch (error) {
      console.error('Account deletion failed:', error);

      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
      ) {
        return sendApiError(
          res,
          401,
          'unauthorized',
          'Firebase session is no longer valid for account deletion.',
          'Sign in again before deleting your account data.',
        );
      }

      if (
        error instanceof Error
        && (
          error.message.includes('Could not load the default credentials')
          || error.message.includes('Firebase Admin is missing')
          || error.message.includes('Failed to parse private key')
        )
      ) {
        return sendApiError(
          res,
          503,
          'missing_configuration',
          error.message,
          'Firebase Admin credentials are not configured on the server yet. Add the admin credentials, then retry the account deletion.',
        );
      }

      return sendApiError(
        res,
        500,
        'processing_failed',
        error instanceof Error ? error.message : 'Unknown account deletion error.',
        'We could not finish deleting that account right now. Please try again in a moment.',
      );
    }
  });

  app.post('/api/thumbnail-assistant', aiGenerationLimiter, async (req, res) => {
    try {
      await requireAuthenticatedUserOrGuestTrial(req, 'thumbnail');

      const { provider, userMessage, systemPrompt, apiKey } = req.body as ThumbnailAssistantRequestBody;

      if (provider !== 'groq' && provider !== 'gemini') {
        return sendApiError(res, 400, 'invalid_input', 'Unsupported thumbnail assistant provider.', 'Choose Gemini or Groq for the thumbnail assistant.');
      }

      if (!userMessage || typeof userMessage !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'User message is required.', 'Enter a thumbnail command before sending it.');
      }

      if (!systemPrompt || typeof systemPrompt !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'System prompt is required.', 'The thumbnail assistant prompt is missing. Refresh the page and try again.');
      }

      const providerApiKey = typeof apiKey === 'string' && apiKey.trim()
        ? apiKey.trim()
        : provider === 'gemini'
          ? process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? ''
          : process.env.GROQ_API_KEY ?? '';

      if (!providerApiKey) {
        return sendApiError(
          res,
          503,
          'missing_configuration',
          `${provider} API key is missing for thumbnail assistant requests.`,
          provider === 'gemini'
            ? 'Add a Gemini API key in settings or on the server, then try again.'
            : 'Add a Groq API key in settings or on the server, then try again.',
        );
      }

      const content = await executeThumbnailAssistantRequest(provider, providerApiKey, systemPrompt, userMessage);
      return res.json({ content });
    } catch (error) {
      console.error('Thumbnail assistant request failed:', error);

      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
        || (error instanceof Error && error.message.includes('Missing Firebase ID token'))
      ) {
        return sendApiError(res, 401, 'unauthorized', error instanceof Error ? error.message : 'Unauthorized thumbnail assistant request.', getAuthUserMessage(error));
      }

      if (isQuotaExceededError(error)) {
        return sendApiError(res, 403, 'quota_exceeded', error.message, getQuotaExceededUserMessage(error.kind));
      }

      const classified = classifyProviderError(error instanceof Error ? error.message : 'Thumbnail assistant provider unavailable.');
      return sendApiError(res, 502, classified.code, error instanceof Error ? error.message : 'Thumbnail assistant provider unavailable.', classified.userMessage);
    }
  });

  // ===== YOUTUBE URL → TRANSCRIPT → SCRIPT ENDPOINT =====
  app.post("/api/youtube-to-script", aiGenerationLimiter, async (req, res) => {
    try {
      await requireAuthenticatedUserOrGuestTrial(req, 'draft');
    } catch (error) {
      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
        || (error instanceof Error && error.message.includes('Missing Firebase ID token'))
      ) {
        return sendApiError(res, 401, 'unauthorized', error instanceof Error ? error.message : 'Unauthorized AI request.', getAuthUserMessage(error));
      }

      if (isQuotaExceededError(error)) {
        return sendApiError(res, 403, 'quota_exceeded', error.message, getQuotaExceededUserMessage(error.kind));
      }

      return sendApiError(res, 500, 'processing_failed', error instanceof Error ? error.message : 'Failed to validate request quota.', 'We could not validate your account usage right now. Please try again.');
    }

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

    // Step 2: learn the transcript's rhetorical pattern, then generate a new script from it
    const groqErrorCapture: { message: string } = { message: '' };
    const hfErrorCapture: { message: string } = { message: '' };
    const geminiErrorCapture: { message: string } = { message: '' };
    let resultProvider: 'groq' | 'huggingface' | 'gemini' = provider;

    const tryYouTubeDraft = async (p: 'groq' | 'huggingface' | 'gemini') => {
      if (p === 'gemini') return generateYouTubeStyleDraftWithGemini(title, transcript, geminiErrorCapture);
      return generateYouTubeStyleDraftWithProvider(p, title, transcript, p === 'groq' ? groqErrorCapture : hfErrorCapture);
    };

    let generatedYouTubeDraft = await tryYouTubeDraft(provider);

    if (!generatedYouTubeDraft) {
      const allProviders: Array<'groq' | 'huggingface' | 'gemini'> = ['groq', 'huggingface', 'gemini'];
      for (const fallback of allProviders) {
        if (fallback === provider) continue;
        const keyPresent = fallback === 'groq' ? !!process.env.GROQ_API_KEY
          : fallback === 'huggingface' ? !!process.env.HUGGINGFACE_API_KEY
          : !!process.env.GEMINI_DRAFT_API_KEY;
        if (!keyPresent) continue;
        resultProvider = fallback;
        generatedYouTubeDraft = await tryYouTubeDraft(fallback);
        if (generatedYouTubeDraft) break;
      }
    }

    if (!generatedYouTubeDraft) {
      const detail = groqErrorCapture.message || hfErrorCapture.message || geminiErrorCapture.message;
      const classified = classifyProviderError(detail || 'Failed to generate script from the video transcript.');
      return sendApiError(
        res,
        502,
        classified.code,
        `Failed to generate script from the video transcript.${detail ? ` Details: ${detail}` : ''}`,
        classified.userMessage
      );
    }

    const result = buildIdeaScriptDraft(title, { targetMinutes: 10 }, generatedYouTubeDraft.script, resultProvider);
    res.json({
      ...result,
      styleProfile: generatedYouTubeDraft.styleProfile,
      sourceTitle: title,
    });
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

  app.post('/api/script/apply-pattern', aiGenerationLimiter, async (req, res) => {
    try {
      await requireAuthenticatedUserOrGuestTrial(req, 'draft');

      const { patternScript, userScript, targetMinutes, apiKey } = req.body as PatternApplicationRequestBody;

      if (!patternScript || typeof patternScript !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'Pattern script is required.', 'Drag a saved pattern into the editor to continue.');
      }

      if (!userScript || typeof userScript !== 'string') {
        return sendApiError(res, 400, 'invalid_input', 'User script is required.', 'Paste a draft into the editor before applying a pattern.');
      }

      const patternLengthError = enforceMaxLength(
        res,
        patternScript,
        'Pattern script',
        MAX_SCRIPT_LENGTH,
        'That pattern is too large to process in one request. Shorten the saved pattern and try again.'
      );
      if (patternLengthError) {
        return patternLengthError;
      }

      const userScriptLengthError = enforceMaxLength(
        res,
        userScript,
        'User script',
        MAX_SCRIPT_LENGTH,
        'That draft is too large to improve in one request. Split it into smaller parts and try again.'
      );
      if (userScriptLengthError) {
        return userScriptLengthError;
      }

      const trimmedApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
      const normalizedTargetMinutes = normalizeTargetMinutes(targetMinutes);
      const provider = trimmedApiKey ? 'groq' : getAvailableStructuredGenerationProvider();
      if (!provider) {
        return res.json({ script: buildFallbackPatternAppliedScript(patternScript, userScript, normalizedTargetMinutes), source: 'local-pattern-fallback' });
      }

      const groqErrorCapture: { message: string } = { message: '' };
      const hfErrorCapture: { message: string } = { message: '' };

      let improvedScript = await generatePatternAppliedScriptWithProvider(
        provider,
        patternScript,
        userScript,
        normalizedTargetMinutes,
        provider === 'groq' ? trimmedApiKey : undefined,
        provider === 'groq' ? groqErrorCapture : hfErrorCapture
      );

      if (!improvedScript) {
        for (const fallback of getFallbackStructuredGenerationProviders(provider)) {
          improvedScript = await generatePatternAppliedScriptWithProvider(
            fallback,
            patternScript,
            userScript,
            normalizedTargetMinutes,
            fallback === 'groq' ? trimmedApiKey : undefined,
            fallback === 'groq' ? groqErrorCapture : hfErrorCapture
          );
          if (improvedScript) {
            break;
          }
        }
      }

      if (!improvedScript) {
        improvedScript = buildFallbackPatternAppliedScript(patternScript, userScript, normalizedTargetMinutes);
      }

      return res.json({ script: improvedScript.trim() });
    } catch (error) {
      console.error('Pattern application request failed:', error);

      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
        || (error instanceof Error && error.message.includes('Missing Firebase ID token'))
      ) {
        return sendApiError(res, 401, 'unauthorized', error instanceof Error ? error.message : 'Unauthorized AI request.', getAuthUserMessage(error));
      }

      if (isQuotaExceededError(error)) {
        return sendApiError(res, 403, 'quota_exceeded', error.message, getQuotaExceededUserMessage(error.kind));
      }

      return sendApiError(
        res,
        500,
        'processing_failed',
        error instanceof Error ? error.message : 'Failed to apply the pattern to the script.',
        'We could not apply that pattern right now. Please try again in a moment.'
      );
    }
  });

  /**
   * Analyze a YouTube URL and extract its scriptwriting pattern DNA.
   * Returns a structured pattern that can be saved and reused to generate new scripts.
   */
  app.post("/api/script/analyze-url", aiGenerationLimiter, async (req, res) => {
    try {
      await requireAuthenticatedUserOrGuestTrial(req, 'draft');
    } catch (error) {
      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
        || (error instanceof Error && error.message.includes('Missing Firebase ID token'))
      ) {
        return sendApiError(res, 401, 'unauthorized', error instanceof Error ? error.message : 'Unauthorized AI request.', getAuthUserMessage(error));
      }
      if (isQuotaExceededError(error)) {
        return sendApiError(res, 403, 'quota_exceeded', error.message, getQuotaExceededUserMessage(error.kind));
      }
      return sendApiError(res, 500, 'processing_failed', error instanceof Error ? error.message : 'Quota check failed.', 'We could not validate your account usage right now. Please try again.');
    }

    const { url } = req.body as { url?: string };

    if (!url || typeof url !== 'string') {
      return sendApiError(res, 400, 'invalid_input', 'YouTube URL is required', 'Please enter a YouTube URL to analyze.');
    }

    const urlLengthError = enforceMaxLength(res, url, 'YouTube URL', MAX_URL_LENGTH, 'That YouTube URL is unexpectedly long. Please use a standard video link.');
    if (urlLengthError) return urlLengthError;

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return sendApiError(res, 400, 'invalid_input', 'Invalid YouTube URL.', 'That link does not look like a valid YouTube video URL. Please check it and try again.');
    }

    const provider = getAvailableStructuredGenerationProvider();
    if (!provider) {
      return sendApiError(res, 503, 'missing_configuration', 'Missing AI API key.', 'The AI service is not configured yet. Add a supported structured-output provider key, then try again.');
    }

    console.log(`Analyzing YouTube pattern for: ${videoId}`);

    const transcriptResult = await fetchYouTubeTranscript(videoId);
    if ('error' in transcriptResult) {
      const classified = classifyTranscriptError(transcriptResult.error);
      return sendApiError(res, 422, classified.code, transcriptResult.error, classified.userMessage);
    }

    const { title, transcript } = transcriptResult;

    const patternResult = await analyzeUrlAsPattern(title, transcript, provider);
    if (!patternResult) {
      return sendApiError(res, 502, 'provider_unavailable', 'Pattern analysis failed.', 'The AI could not analyze this video right now. Please try again in a moment.');
    }

    // Build a ready-to-save pattern content string from the analysis
    const patternContent = [
      `STYLE PROFILE\n${patternResult.styleProfile}`,
      `HOOK FORMULA\n${patternResult.hookFormula}`,
      `RETENTION LOOPS\n${patternResult.retentionLoops.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      `TRANSITION PHRASES\n${patternResult.transitionPhrases.join(' | ')}`,
      `EXAMPLE STRUCTURE\n${patternResult.exampleStructure}`,
      `CTA STYLE\n${patternResult.ctaStyle}`,
      `PACING BLUEPRINT\n${patternResult.pacingBlueprint}`,
      `KEYWORD STRATEGY\n${patternResult.keywordStrategy.join(', ')}`,
      `POWER WORDS\n${patternResult.powerWords.join(', ')}`,
      `APPLICABLE TEMPLATE\n${patternResult.applicableTemplate}`,
    ].join('\n\n');

    res.json({
      ...patternResult,
      patternContent,
      suggestedName: `${title.slice(0, 40)} Pattern`,
      transcript,
    });
  });

  app.post("/api/process/idea-draft", aiGenerationLimiter, async (req, res) => {
    try {
      await requireAuthenticatedUserOrGuestTrial(req, 'idea');

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
      const geminiErrorCapture: { message: string } = { message: '' };

      let resultProvider: 'groq' | 'huggingface' | 'gemini' = provider;

      const getCapture = (p: 'groq' | 'huggingface' | 'gemini') =>
        p === 'groq' ? groqErrorCapture : p === 'gemini' ? geminiErrorCapture : hfErrorCapture;

      // Try primary provider first
      let expandedIdea = await generateIdeaDraftWithProvider(provider, idea, sections, getCapture(provider), platform);

      // Fallback through remaining providers if primary failed
      if (!expandedIdea) {
        for (const fallback of getFallbackIdeaDraftProviders(provider)) {
          resultProvider = fallback;
          expandedIdea = await generateIdeaDraftWithProvider(fallback, idea, sections, getCapture(fallback), platform);
          if (expandedIdea) break;
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
          'You\'ve hit today\'s usage limit. Come back tomorrow for more credits, or switch to another provider.'
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

      // Generate SEO bundle (non-blocking — failure is silent)
      const seoProvider: StructuredGenerationProvider | undefined = resultProvider === 'gemini'
        ? undefined
        : resultProvider;
      const seo = await generateScriptSEO(idea, result.draft, seoProvider).catch(() => null);

      res.json({ ...result, seo: seo ?? null });
    } catch (error) {
      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
        || (error instanceof Error && error.message.includes('Missing Firebase ID token'))
      ) {
        return sendApiError(res, 401, 'unauthorized', error instanceof Error ? error.message : 'Unauthorized AI request.', getAuthUserMessage(error));
      }

      if (isQuotaExceededError(error)) {
        return sendApiError(res, 403, 'quota_exceeded', error.message, getQuotaExceededUserMessage(error.kind));
      }

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

    try {
      await requireAuthenticatedUserOrGuestTrial(req, 'draft');
    } catch (error) {
      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
        || (error instanceof Error && error.message.includes('Missing Firebase ID token'))
      ) {
        return sendApiError(res, 401, 'unauthorized', error instanceof Error ? error.message : 'Unauthorized AI request.', getAuthUserMessage(error));
      }

      if (isQuotaExceededError(error)) {
        return sendApiError(res, 403, 'quota_exceeded', error.message, getQuotaExceededUserMessage(error.kind));
      }

      return sendApiError(res, 500, 'processing_failed', error instanceof Error ? error.message : 'Failed to validate request quota.', 'We could not validate your account usage right now. Please try again.');
    }

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

    try {
      await requireAuthenticatedUserOrGuestTrial(req, 'draft');
    } catch (error) {
      if (
        hasFirebaseAdminErrorCode(error, 'auth/id-token-expired')
        || hasFirebaseAdminErrorCode(error, 'auth/argument-error')
        || hasFirebaseAdminErrorCode(error, 'auth/invalid-id-token')
        || hasFirebaseAdminErrorCode(error, 'auth/user-disabled')
        || (error instanceof Error && error.message.includes('Missing Firebase ID token'))
      ) {
        return sendApiError(res, 401, 'unauthorized', error instanceof Error ? error.message : 'Unauthorized AI request.', getAuthUserMessage(error));
      }

      if (isQuotaExceededError(error)) {
        return sendApiError(res, 403, 'quota_exceeded', error.message, getQuotaExceededUserMessage(error.kind));
      }

      return sendApiError(res, 500, 'processing_failed', error instanceof Error ? error.message : 'Failed to validate request quota.', 'We could not validate your account usage right now. Please try again.');
    }

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
