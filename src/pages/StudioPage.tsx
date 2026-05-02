import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Youtube,
  Upload,
  MessageSquare,
  Copy,
  Check,
  Loader2,
  Download,
  CloudUpload,
  Sparkles,
  Settings2,
  User,
  Play,
  FileText,
  Zap,
  Hash,
  Share2,
  Target,
  Lightbulb,
  Layers,
  X,
  Clock3,
  AlertTriangle,
  WandSparkles,
  Flag,
  CircleCheckBig,
  Bot,
  ChevronRight,
  ChevronDown,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { generateIdeaDraft, IdeaDraftResponse, processYouTubeUrl, processUploadedScript, ProcessingResult } from '../services/geminiService';
import { saveProject, updateProject } from '../services/projectService';
import { getUserScopedStorageKey, readBrowserStorageValue, writeBrowserStorageValue } from '../services/browserStorage';
import { getUserScopedDownloadName } from '../services/userPaths';
import { LoadingMiniGame } from '../components/LoadingMiniGame';
import { useAuth } from '../context/AuthContext';
import UserAvatarMenu from '../components/UserAvatarMenu';

type StorySectionKey = 'introduction' | 'development' | 'climax' | 'resolution';
type ArchitectureLayerKind = 'foundation' | 'build' | 'connection' | 'outcome' | 'expansion' | 'final';
type ArchitectureLayerStatus = 'ready' | 'warning' | 'needs-detail';

interface ArchitectureLayer {
  id: string;
  title: string;
  kind: ArchitectureLayerKind;
  section: StorySectionKey;
  timestamp: string;
  timeLabel: string;
  chapter: string;
  purpose: string;
  content: string;
  dependsOn: string[];
  interactionLabel: string;
  emotionalBeat?: string;
  visuals: string[];
  sounds: string[];
  status: ArchitectureLayerStatus;
}

interface DerivedStudioResults {
  highlights: { timestamp: string; title: string; score: number }[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  socialCaptions: string[];
  layeredArchitecture: ArchitectureLayer[];
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'this', 'that', 'these', 'those', 'into', 'about', 'your', 'their',
  'them', 'then', 'than', 'what', 'when', 'where', 'while', 'which', 'who', 'why', 'how'
]);

const SUPPORTED_SCRIPT_FILE_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'srt',
  'vtt',
]);

const SCRIPT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const SCRIPT_UPLOAD_ALLOWED_LABEL = 'TXT, MD, JSON, CSV, SRT, or VTT';

function getFileExtension(fileName: string): string {
  const segments = fileName.toLowerCase().split('.');
  return segments.length > 1 ? segments[segments.length - 1] : '';
}

function getScriptUploadError(file: File): string | null {
  if (file.type.startsWith('video/')) {
    return `Video files are not allowed here. Please upload a ${SCRIPT_UPLOAD_ALLOWED_LABEL} file, paste your script, or use a YouTube URL instead.`;
  }

  if (file.type.startsWith('audio/')) {
    return `Audio files are not allowed here. Please upload a ${SCRIPT_UPLOAD_ALLOWED_LABEL} file or paste your script instead.`;
  }

  const extension = getFileExtension(file.name);
  if (!SUPPORTED_SCRIPT_FILE_EXTENSIONS.has(extension)) {
    return `This file type is not supported here. Please upload a ${SCRIPT_UPLOAD_ALLOWED_LABEL} file.`;
  }

  if (file.size > SCRIPT_UPLOAD_MAX_BYTES) {
    return `This file is too large. Please upload a ${SCRIPT_UPLOAD_ALLOWED_LABEL} file smaller than 20 MB.`;
  }

  return null;
}

const IDEA_SECTION_MINIMUMS = {
  introduction: 18,
  development: 32,
  climax: 24,
  resolution: 18,
} as const;

const SCRIPT_PRESETS = [
  {
    id: 'explainer-15',
    name: 'Explainer 15m',
    description: 'Balanced educational structure with a clear takeaway.',
    targetMinutes: 15,
    sections: {
      introduction: 'Open with the audience problem, explain why it matters, and promise a clear step-by-step payoff by the end of the video.',
      development: 'Break the topic into practical steps, examples, and talking points that build from beginner-friendly context into deeper insight.',
      climax: 'Reveal the biggest lesson, mistake, or breakthrough that reframes the topic and gives the viewer the strongest value moment.',
      resolution: 'Summarize the key lesson, give a next step, and close with a direct call to action tied to the viewer outcome.',
    },
  },
  {
    id: 'story-15',
    name: 'Story Arc',
    description: 'Narrative pacing with conflict, turn, and payoff.',
    targetMinutes: 15,
    sections: {
      introduction: 'Set the scene, introduce the character or perspective, and establish the tension that makes the audience want to stay.',
      development: 'Develop the journey through obstacles, dialogue beats, and escalating stakes that keep the narrative moving.',
      climax: 'Deliver the turning point, reveal, or emotional peak where the main tension breaks open.',
      resolution: 'Show what changed, what it means, and why the audience should care or respond after the story ends.',
    },
  },
  {
    id: 'layered-architecture-12',
    name: 'Layered Architecture',
    description: 'Structure your script around clear conceptual layers and integration points.',
    targetMinutes: 12,
    sections: {
      introduction: 'Introduce the main idea and establish the foundational layer that supports the rest of the script.',
      development: 'Build the next layer by adding supporting ideas, examples, and technical context that deepen the understanding.',
      climax: 'Show the integration layer where all parts connect and explain how the layered architecture solves the viewer’s problem.',
      resolution: 'Summarize the layered structure, reinforce why each layer mattered, and give a practical next step or takeaway.',
    },
  },
  {
    id: 'tutorial-10',
    name: 'Tutorial 10m',
    description: 'Shorter practical format with tighter pacing.',
    targetMinutes: 10,
    sections: {
      introduction: 'State the result the viewer will get and the exact problem this tutorial solves in a simple, direct hook.',
      development: 'Walk through the process in a clear order with short examples, screen actions, and practical explanations.',
      climax: 'Show the key step, transformation, or result that makes the process click for the viewer.',
      resolution: 'Recap the steps quickly, reinforce the result, and tell the viewer what to try next.',
    },
  },
] as const;

const STYLE_PRESETS = [
  {
    id: 'educational',
    name: 'Educational',
    icon: FileText,
    accent: 'from-sky-500/20 to-cyan-500/10 border-sky-500/30 text-sky-200',
    hint: 'Clear structure, practical examples, teacher tone.',
    promptHint: 'Use an educational tone with clear explanation, practical examples, and structured teaching flow.',
  },
  {
    id: 'layered-architecture',
    name: 'Layered Architecture',
    icon: Layers,
    accent: 'from-slate-500/20 to-slate-400/10 border-slate-500/30 text-slate-200',
    hint: 'Organize content into distinct layers and integration points.',
    promptHint: 'Write a layered architecture script: build from foundational context to higher-level integration, with each section clearly labeled and connected.',
  },
  {
    id: 'entertaining',
    name: 'Entertaining',
    icon: Sparkles,
    accent: 'from-violet-500/20 to-fuchsia-500/10 border-violet-500/30 text-violet-200',
    hint: 'Energetic pacing, hooks, punchier phrasing.',
    promptHint: 'Use an entertaining tone with energetic pacing, vivid hooks, and memorable lines.',
  },
  {
    id: 'inspirational',
    name: 'Inspirational',
    icon: TrendingUp,
    accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-100',
    hint: 'Motivational framing, emotional arc, uplift.',
    promptHint: 'Use an inspirational tone with motivational framing, emotional momentum, and a strong uplifting CTA.',
  },
] as const;

const CREATOR_STORIES = [
  {
    creator: 'Amina Vlogs',
    quote: 'I went from scattered notes to a publish-ready script pack in minutes.',
    metric: '+38% watch time',
    gradient: 'from-emerald-500/20 to-cyan-500/5',
  },
  {
    creator: 'Pixel Coach',
    quote: 'The timeline and caption preview helped my team ship three shorts in one day.',
    metric: '3x faster publishing',
    gradient: 'from-violet-500/20 to-fuchsia-500/5',
  },
  {
    creator: 'Growth Notes',
    quote: 'SEO titles and chapters are now consistent across every upload.',
    metric: '+24% CTR',
    gradient: 'from-amber-500/20 to-orange-500/5',
  },
] as const;

const ANALYTICS_STORAGE_KEY_PREFIX = 'tubeflow.analytics.v1';

const DEFAULT_IDEA_SECTIONS = {
  introduction: '',
  development: '',
  climax: '',
  resolution: '',
  targetMinutes: 15,
};

function formatPhaseTimingLabel(totalMinutes: number, phase: 'introduction' | 'development' | 'climax' | 'resolution') {
  const exactMinutes = totalMinutes * (phase === 'introduction' ? 0.1 : phase === 'resolution' ? 0.2 : 0.35);
  const lower = Math.max(1, Math.floor(exactMinutes));
  const upper = Math.max(lower, Math.ceil(exactMinutes));

  if (lower === upper) {
    return `${lower} min`;
  }

  return `${lower}-${upper} min`;
}

function normalizeIdeaSectionsState(sections?: Partial<IdeaDraftResponse['sections']>) {
  return {
    introduction: typeof sections?.introduction === 'string' ? sections.introduction : DEFAULT_IDEA_SECTIONS.introduction,
    development: typeof sections?.development === 'string' ? sections.development : DEFAULT_IDEA_SECTIONS.development,
    climax: typeof sections?.climax === 'string' ? sections.climax : DEFAULT_IDEA_SECTIONS.climax,
    resolution: typeof sections?.resolution === 'string' ? sections.resolution : DEFAULT_IDEA_SECTIONS.resolution,
    targetMinutes: typeof sections?.targetMinutes === 'number' && Number.isFinite(sections.targetMinutes)
      ? sections.targetMinutes
      : DEFAULT_IDEA_SECTIONS.targetMinutes,
  };
}

function getErrorDisplay(error: string) {
  const normalized = error.trim().toLowerCase();

  if (normalized.includes('credit') || normalized.includes('quota')) {
    return {
      title: 'Credits Used Up',
      accent: 'border-amber-500/35 bg-amber-500/10 text-amber-100',
      icon: 'text-amber-300',
      hint: 'Nothing is wrong with your draft. The provider just needs more credits before it can continue.',
    };
  }

  if (normalized.includes('timeout') || normalized.includes('timed out') || normalized.includes('longer than usual')) {
    return {
      title: 'Still Working, Just Too Slow',
      accent: 'border-sky-500/35 bg-sky-500/10 text-sky-100',
      icon: 'text-sky-300',
      hint: 'Please wait a moment and try again. A slower response usually means the service is under load, not that your data is lost.',
    };
  }

  if (normalized.includes('caption') || normalized.includes('subtitle')) {
    return {
      title: 'Captions Not Available',
      accent: 'border-violet-500/35 bg-violet-500/10 text-violet-100',
      icon: 'text-violet-300',
      hint: 'You can try another video or paste a script manually to keep moving.',
    };
  }

  if (normalized.includes('private') || normalized.includes('restricted') || normalized.includes('unavailable')) {
    return {
      title: 'Video Could Not Be Accessed',
      accent: 'border-rose-500/35 bg-rose-500/10 text-rose-100',
      icon: 'text-rose-300',
      hint: 'Check the video link and permissions, then try again.',
    };
  }

  if (normalized.includes('api key') || normalized.includes('not configured')) {
    return {
      title: 'Service Setup Needed',
      accent: 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-100',
      icon: 'text-fuchsia-300',
      hint: 'Add a valid provider key in settings or the server environment, then run the request again.',
    };
  }

  return {
    title: 'Could Not Finish That Request',
    accent: 'border-red-500/30 bg-red-950/40 text-red-200',
    icon: 'text-red-400',
    hint: 'Please try again in a moment. If it keeps happening, switch the input or provider and retry.',
  };
}

function normalizeIdeaDraftMeta(response: IdeaDraftResponse, fallbackSections: typeof DEFAULT_IDEA_SECTIONS): IdeaDraftResponse {
  const sections = normalizeIdeaSectionsState(response?.sections ?? fallbackSections);
  const sectionValidations = [
    {
      section: 'introduction' as const,
      wordCount: countSectionWords(sections.introduction),
      minimumWords: IDEA_SECTION_MINIMUMS.introduction,
      isValid: countSectionWords(sections.introduction) >= IDEA_SECTION_MINIMUMS.introduction,
      issues: countSectionWords(sections.introduction) >= IDEA_SECTION_MINIMUMS.introduction ? [] : ['Add more detail to the introduction section.'],
    },
    {
      section: 'development' as const,
      wordCount: countSectionWords(sections.development),
      minimumWords: IDEA_SECTION_MINIMUMS.development,
      isValid: countSectionWords(sections.development) >= IDEA_SECTION_MINIMUMS.development,
      issues: countSectionWords(sections.development) >= IDEA_SECTION_MINIMUMS.development ? [] : ['Add more detail to the development section.'],
    },
    {
      section: 'climax' as const,
      wordCount: countSectionWords(sections.climax),
      minimumWords: IDEA_SECTION_MINIMUMS.climax,
      isValid: countSectionWords(sections.climax) >= IDEA_SECTION_MINIMUMS.climax,
      issues: countSectionWords(sections.climax) >= IDEA_SECTION_MINIMUMS.climax ? [] : ['Add more detail to the climax section.'],
    },
    {
      section: 'resolution' as const,
      wordCount: countSectionWords(sections.resolution),
      minimumWords: IDEA_SECTION_MINIMUMS.resolution,
      isValid: countSectionWords(sections.resolution) >= IDEA_SECTION_MINIMUMS.resolution,
      issues: countSectionWords(sections.resolution) >= IDEA_SECTION_MINIMUMS.resolution ? [] : ['Add more detail to the resolution section.'],
    },
  ];

  const safeValidation = response?.validation
    ? {
        isValid: typeof response.validation.isValid === 'boolean'
          ? response.validation.isValid
          : sectionValidations.every((section) => section.isValid),
        sentenceCount: typeof response.validation.sentenceCount === 'number' ? response.validation.sentenceCount : 0,
        issues: Array.isArray(response.validation.issues) ? response.validation.issues : [],
        sectionValidations: Array.isArray(response.validation.sectionValidations) && response.validation.sectionValidations.length > 0
          ? response.validation.sectionValidations
          : sectionValidations,
      }
    : {
        isValid: sectionValidations.every((section) => section.isValid),
        sentenceCount: 0,
        issues: [],
        sectionValidations,
      };

  return {
    draft: typeof response?.draft === 'string' ? response.draft : '',
    outline: Array.isArray(response?.outline) ? response.outline : [],
    keywords: Array.isArray(response?.keywords) ? response.keywords : [],
    sections,
    cues: Array.isArray(response?.cues) ? response.cues : [],
    timeline: Array.isArray(response?.timeline) ? response.timeline : [],
    validation: safeValidation,
    source: response?.source === 'groq' ? 'groq' : response?.source === 'huggingface' ? 'huggingface' : 'local-nlp',
  };
}

function hasGeneratedStoryboardContent(sections: typeof DEFAULT_IDEA_SECTIONS) {
  return [sections.introduction, sections.development, sections.climax, sections.resolution]
    .some((section) => section.trim().length > 0);
}

function countSectionWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getSectionVisualState(wordCount: number, minimumWords: number) {
  if (wordCount >= minimumWords) {
    return {
      tone: 'ready',
      border: 'border-emerald-500/30',
      background: 'bg-emerald-500/10',
      text: 'text-emerald-200',
      chip: 'text-emerald-300',
    };
  }

  if (wordCount >= Math.max(8, Math.floor(minimumWords * 0.65))) {
    return {
      tone: 'warning',
      border: 'border-amber-500/30',
      background: 'bg-amber-500/10',
      text: 'text-amber-100',
      chip: 'text-amber-300',
    };
  }

  return {
    tone: 'needs-detail',
    border: 'border-rose-500/30',
    background: 'bg-rose-500/10',
    text: 'text-rose-100',
    chip: 'text-rose-300',
  };
}

function formatTimelineWindow(minutes: number, index: number, totalMinutes: number) {
  const phaseOrder: Array<'introduction' | 'development' | 'climax' | 'resolution'> = [
    'introduction',
    'development',
    'climax',
    'resolution',
  ];

  const phase = phaseOrder[index];
  if (phase) {
    return formatPhaseTimingLabel(totalMinutes, phase);
  }

  if (minutes <= 1) {
    return '1 min';
  }

  return `${Math.max(1, minutes - 1)}-${minutes} min`;
}

function formatClockLabel(totalMinutes: number) {
  return `${String(totalMinutes).padStart(2, '0')}:00`;
}

function getTargetWordRange(totalMinutes: number) {
  if (totalMinutes === 8) {
    return { min: 1000, max: 1200 };
  }

  if (totalMinutes === 10) {
    return { min: 1200, max: 1400 };
  }

  if (totalMinutes === 20) {
    return { min: 2300, max: 2500 };
  }

  return { min: 1800, max: 2000 };
}

function countGeneratedWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getScriptWordTarget(totalMinutes: number): number {
  if (totalMinutes === 8) return 1100;
  if (totalMinutes === 10) return 1300;
  if (totalMinutes === 20) return 2400;
  return 1900;
}

function formatIdeaDraftSource(source: IdeaDraftResponse['source']) {
  if (source === 'groq') {
    return 'Groq (Llama 3.3) expansion';
  }

  if (source === 'huggingface') {
    return 'Hugging Face expansion';
  }

  return 'Local NLP fallback';
}

function extractKeywords(text: string, limit = 8) {
  const words = text
    .toLowerCase()
    .match(/[a-z]{4,}/g)?.filter((word) => !STOP_WORDS.has(word)) ?? [];

  const counts = new Map<string, number>();
  words.forEach((word) => {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function clipText(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function parseTimestampToSeconds(timestamp: string) {
  const cleaned = timestamp.replace(/[\[\]]/g, '').trim();
  const parts = cleaned.split(':').map((part) => Number(part));

  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }

  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }

  return Number.isFinite(parts[0]) ? parts[0] : 0;
}

function formatTimecode(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildTimeLabel(startSeconds: number, endSeconds: number) {
  return `${formatTimecode(startSeconds)} → ${formatTimecode(Math.max(startSeconds, endSeconds))}`;
}

function getTranscriptSegments(transcript: string) {
  const normalized = transcript.replace(/\s+(?=\[?\d{1,2}:\d{2}(?::\d{2})?\]?)/g, '\n');
  const lineSegments = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lineSegments.length > 1) {
    return lineSegments;
  }

  const timestampChunks = normalized
    .split(/(?=\[?\d{1,2}:\d{2}(?::\d{2})?\]?)/)
    .map((item) => item.trim())
    .filter(Boolean);

  return timestampChunks.length > 0 ? timestampChunks : (normalized.trim() ? [normalized.trim()] : []);
}

function getLayerStatus(wordCount: number, minimumWords: number): ArchitectureLayerStatus {
  if (wordCount >= minimumWords) {
    return 'ready';
  }

  if (wordCount >= Math.max(8, Math.floor(minimumWords * 0.65))) {
    return 'warning';
  }

  return 'needs-detail';
}

function getLayerToneClasses(status: ArchitectureLayerStatus, selected = false) {
  const emphasis = selected ? 'ring-1 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]' : '';

  if (status === 'ready') {
    return `border-emerald-500/30 bg-emerald-500/10 ${emphasis}`.trim();
  }

  if (status === 'warning') {
    return `border-amber-500/30 bg-amber-500/10 ${emphasis}`.trim();
  }

  return `border-rose-500/30 bg-rose-500/10 ${emphasis}`.trim();
}

function buildIdeaStoryboardLayers(meta: IdeaDraftResponse): ArchitectureLayer[] {
  const validationMap = new Map(meta.validation.sectionValidations.map((item) => [item.section, item]));
  const cueMap = new Map(meta.cues.map((item) => [item.section, item]));
  const timelineMinutes = {
    introduction: meta.timeline[0]?.minutes ?? 1,
    development: meta.timeline[1]?.minutes ?? 4,
    climax: meta.timeline[2]?.minutes ?? 3,
    resolution: meta.timeline[3]?.minutes ?? 2,
  } as const;

  const introductionEnd = timelineMinutes.introduction * 60;
  const buildStart = introductionEnd;
  const buildEnd = buildStart + (timelineMinutes.development * 60);
  const connectionStart = Math.max(buildStart, buildEnd - Math.round((timelineMinutes.development * 60) * 0.35));
  const connectionEnd = buildEnd + Math.round((timelineMinutes.climax * 60) * 0.3);
  const outcomeStart = buildEnd;
  const outcomeEnd = outcomeStart + (timelineMinutes.climax * 60);
  const expansionStart = Math.max(outcomeStart, outcomeEnd - Math.round((timelineMinutes.climax * 60) * 0.25));
  const totalDuration = (meta.sections.targetMinutes || 15) * 60;
  const finalStart = Math.max(expansionStart + 45, totalDuration - ((timelineMinutes.resolution * 60) || 90));

  const createLayer = (
    id: string,
    title: string,
    kind: ArchitectureLayerKind,
    section: StorySectionKey,
    startSeconds: number,
    endSeconds: number,
    chapter: string,
    purpose: string,
    content: string,
    dependsOn: string[],
    interactionLabel: string,
  ): ArchitectureLayer => {
    const validation = validationMap.get(section);
    const cue = cueMap.get(section);

    return {
      id,
      title,
      kind,
      section,
      timestamp: formatTimecode(startSeconds),
      timeLabel: buildTimeLabel(startSeconds, endSeconds),
      chapter,
      purpose,
      content: clipText(content, 240),
      dependsOn,
      interactionLabel,
      emotionalBeat: cue?.emotionalBeat,
      visuals: cue?.visuals ?? [],
      sounds: cue?.sounds ?? [],
      status: getLayerStatus(validation?.wordCount ?? 0, validation?.minimumWords ?? 1),
    };
  };

  return [
    createLayer(
      'foundation-layer',
      'Foundation Layer',
      'foundation',
      'introduction',
      0,
      introductionEnd,
      'Hook and premise',
      'Sets the theme, intro, and the viewer promise that everything else depends on.',
      meta.sections.introduction,
      [],
      'Open the script from this layer.'
    ),
    createLayer(
      'build-layer',
      'Build Layer',
      'build',
      'development',
      buildStart,
      buildEnd,
      'Character and motivation',
      'Expands the idea with evidence, character logic, and deeper context.',
      meta.sections.development,
      ['foundation-layer'],
      'Deepen the narrative here.'
    ),
    createLayer(
      'connection-layer',
      'Connection Layer',
      'connection',
      'development',
      connectionStart,
      connectionEnd,
      'Bridge into the investigation',
      'Links the setup to the reveal so the earlier layers actively support the turning point.',
      `${meta.sections.development} ${meta.sections.climax}`,
      ['foundation-layer', 'build-layer'],
      'Use this bridge to connect the earlier beats.'
    ),
    createLayer(
      'outcome-layer',
      'Outcome Layer',
      'outcome',
      'climax',
      outcomeStart,
      outcomeEnd,
      'First resolution or twist',
      'Shows the first payoff, breakthrough, or twist that changes the viewer’s understanding.',
      meta.sections.climax,
      ['connection-layer'],
      'Focus here for the turning point.'
    ),
    createLayer(
      'expansion-layer',
      'Expansion Layer',
      'expansion',
      'resolution',
      expansionStart,
      finalStart,
      'Added complexity and fallout',
      'Adds nuance, consequences, and further tension after the reveal to keep momentum alive.',
      `${meta.sections.climax} ${meta.sections.resolution}`,
      ['outcome-layer'],
      'Expand the implications from this layer.'
    ),
    createLayer(
      'final-layer',
      'Final Layer',
      'final',
      'resolution',
      finalStart,
      totalDuration,
      'Confrontation and conclusion',
      'Closes the arc with the final takeaway, call to action, and emotional resolution.',
      meta.sections.resolution,
      ['expansion-layer'],
      'Use this layer for the close and CTA.'
    ),
  ];
}

function buildDerivedResults(results: ProcessingResult): DerivedStudioResults {
  const keywords = extractKeywords(`${results.Transcript} ${results.Summary}`);
  const transcriptSegments = getTranscriptSegments(results.Transcript);

  const fallbackHighlights = results.Chapters.slice(0, 6).map((chapter, index) => ({
    timestamp: chapter.timestamp || `${String(index).padStart(2, '0')}:00`,
    title: chapter.title || `Highlight ${index + 1}`,
    score: Math.max(78, 96 - index * 5),
  }));

  const transcriptHighlights = transcriptSegments.slice(0, 6).map((line, index) => {
    const timestampMatch = line.match(/\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/);
    const timestamp = timestampMatch?.[1] || results.Chapters[index]?.timestamp || `${String(index).padStart(2, '0')}:00`;
    const cleanLine = line.replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/, '');

    return {
      timestamp,
      title: clipText(cleanLine, 90) || `Highlight ${index + 1}`,
      score: Math.max(80, 95 - index * 4),
    };
  });

  const descriptionBase = results.Summary.replace(/\s+/g, ' ').trim();
  const sourceEntries = (results.Chapters.length > 0
    ? results.Chapters.map((ch) => `${ch.timestamp} ${ch.title}`)
    : fallbackHighlights.map((item) => `${item.timestamp} ${item.title}`)
  ).slice(0, 6);

  const layerBlueprints: Array<{
    title: string;
    kind: ArchitectureLayerKind;
    section: StorySectionKey;
    purpose: string;
    interactionLabel: string;
    emotionalBeat: string;
  }> = [
    {
      title: 'Foundation Layer',
      kind: 'foundation',
      section: 'introduction',
      purpose: 'Sets the theme and intro promise for the rest of the content.',
      interactionLabel: 'Jump to the opener',
      emotionalBeat: 'Curiosity and setup',
    },
    {
      title: 'Build Layer',
      kind: 'build',
      section: 'development',
      purpose: 'Builds the case with supporting evidence, examples, and motivation.',
      interactionLabel: 'Expand the context',
      emotionalBeat: 'Momentum and clarity',
    },
    {
      title: 'Connection Layer',
      kind: 'connection',
      section: 'development',
      purpose: 'Connects the setup to the central investigation or insight.',
      interactionLabel: 'Trace the bridge',
      emotionalBeat: 'Suspense and linkage',
    },
    {
      title: 'Outcome Layer',
      kind: 'outcome',
      section: 'climax',
      purpose: 'Reaches the first resolution, reveal, or twist.',
      interactionLabel: 'Reveal the payoff',
      emotionalBeat: 'Impact and payoff',
    },
    {
      title: 'Expansion Layer',
      kind: 'expansion',
      section: 'resolution',
      purpose: 'Adds complexity, consequences, or next-stage challenges.',
      interactionLabel: 'Open the fallout',
      emotionalBeat: 'Reflection and tension',
    },
    {
      title: 'Final Layer',
      kind: 'final',
      section: 'resolution',
      purpose: 'Closes the structure with the takeaway and conclusion.',
      interactionLabel: 'Finish the arc',
      emotionalBeat: 'Closure and direction',
    },
  ];

  const layeredArchitecture = sourceEntries.map((chapter, index, chapters) => {
    const blueprint = layerBlueprints[index] ?? layerBlueprints[layerBlueprints.length - 1];
    const timestampMatch = chapter.match(/^(\d{1,2}:\d{2}(?::\d{2})?)/);
    const timestamp = timestampMatch?.[1] ?? `${String(index).padStart(2, '0')}:00`;
    const title = chapter.replace(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*/, '').trim() || `Chapter ${index + 1}`;
    const currentSeconds = parseTimestampToSeconds(timestamp);
    const nextChapter = chapters[index + 1];
    const nextTimestampMatch = nextChapter?.match(/^(\d{1,2}:\d{2}(?::\d{2})?)/);
    const nextSeconds = nextTimestampMatch ? parseTimestampToSeconds(nextTimestampMatch[1]) : currentSeconds + 75;
    const mappedContent = transcriptSegments.find((segment) => segment.includes(timestamp)) ?? transcriptSegments[index] ?? descriptionBase;
    const contentWordCount = mappedContent.split(/\s+/).filter(Boolean).length;

    return {
      id: `${blueprint.kind}-${index}`,
      title: blueprint.title,
      kind: blueprint.kind,
      section: blueprint.section,
      timestamp,
      timeLabel: buildTimeLabel(currentSeconds, nextSeconds),
      chapter: title,
      purpose: blueprint.purpose,
      content: clipText(mappedContent.replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/g, ''), 240),
      dependsOn: index === 0 ? [] : [`${(layerBlueprints[index - 1] ?? layerBlueprints[0]).kind}-${index - 1}`],
      interactionLabel: blueprint.interactionLabel,
      emotionalBeat: blueprint.emotionalBeat,
      visuals: [`Timestamp focus around ${timestamp}`, `Chapter cue: ${title}`, 'Expandable detail panel'],
      sounds: ['Narration emphasis', 'Transition cue'],
      status: contentWordCount >= 18 ? 'ready' : contentWordCount >= 10 ? 'warning' : 'needs-detail',
    } satisfies ArchitectureLayer;
  });

  return {
    highlights: transcriptHighlights.length > 0 ? transcriptHighlights : fallbackHighlights,
    seo: {
      title: keywords.length > 0 ? `${keywords.slice(0, 3).join(' ')} | VideoHelper` : 'VideoHelper | Content Breakdown',
      description: descriptionBase.slice(0, 180),
      keywords,
    },
    socialCaptions: [
      `New breakdown: ${descriptionBase.slice(0, 110)}... #${keywords.slice(0, 3).join(' #')}`,
      `Best moments, clean chapters, and a fast summary from one workflow. ${keywords.slice(0, 2).map((word) => `#${word}`).join(' ')}`,
      `Built with VideoHelper: ${results.Chapters.slice(0, 2).map((ch) => `${ch.timestamp} ${ch.title}`).join(' | ')}`,
    ],
    layeredArchitecture,
  };
}

const StudioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const analyticsKey = getUserScopedStorageKey(ANALYTICS_STORAGE_KEY_PREFIX, user?.uid);
  const [activeTab, setActiveTab] = useState<'youtube' | 'script'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [derivedResults, setDerivedResults] = useState<DerivedStudioResults | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [ideaInput, setIdeaInput] = useState('');
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaDraftMeta, setIdeaDraftMeta] = useState<IdeaDraftResponse | null>(null);
  const [ideaSections, setIdeaSections] = useState(DEFAULT_IDEA_SECTIONS);
  const [ideaPlatform, setIdeaPlatform] = useState<'youtube' | 'tiktok'>('youtube');
  const [selectedStylePreset, setSelectedStylePreset] = useState<(typeof STYLE_PRESETS)[number]['id']>('educational');
  const [storyIndex, setStoryIndex] = useState(0);
  const [analyticsStats, setAnalyticsStats] = useState({ generated: 0, exported: 0, shared: 0 });
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [openPhases, setOpenPhases] = useState<string[]>(['introduction', 'development', 'climax', 'resolution']);
  const transcriptPanelRef = useRef<HTMLDivElement | null>(null);
  const [selectedStoryLayerId, setSelectedStoryLayerId] = useState<string | null>(null);
  const [selectedResultLayerId, setSelectedResultLayerId] = useState<string | null>(null);
  const [activeTranscriptTimestamp, setActiveTranscriptTimestamp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const clickGuardTimersRef = useRef<Record<string, number>>({});
  const scriptFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = readBrowserStorageValue(analyticsKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { generated?: number; exported?: number; shared?: number };
      setAnalyticsStats({
        generated: typeof parsed.generated === 'number' ? parsed.generated : 0,
        exported: typeof parsed.exported === 'number' ? parsed.exported : 0,
        shared: typeof parsed.shared === 'number' ? parsed.shared : 0,
      });
    } catch {
      // Ignore storage parse errors and continue with defaults.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStoryIndex((current) => (current + 1) % CREATOR_STORIES.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ideaDraftMeta) {
      setSelectedStoryLayerId(null);
      return;
    }

    const layers = buildIdeaStoryboardLayers(ideaDraftMeta);
    setSelectedStoryLayerId((current) => (current && layers.some((layer) => layer.id === current) ? current : (layers[0]?.id ?? null)));
  }, [ideaDraftMeta]);

  useEffect(() => {
    if (!derivedResults?.layeredArchitecture.length) {
      setSelectedResultLayerId(null);
      setActiveTranscriptTimestamp(null);
      return;
    }

    setSelectedResultLayerId((current) => (
      current && derivedResults.layeredArchitecture.some((layer) => layer.id === current)
        ? current
        : derivedResults.layeredArchitecture[0].id
    ));
    setActiveTranscriptTimestamp((current) => (
      current && derivedResults.layeredArchitecture.some((layer) => layer.timestamp === current)
        ? current
        : derivedResults.layeredArchitecture[0].timestamp
    ));
  }, [derivedResults]);

  const trackAnalytics = (event: 'generated' | 'exported' | 'shared') => {
    setAnalyticsStats((current) => {
      const updated = {
        ...current,
        [event]: current[event] + 1,
      };

      writeBrowserStorageValue(analyticsKey, JSON.stringify(updated));
      return updated;
    });
  };

  const exportDraftBundle = (platform: 'youtube' | 'tiktok' | 'reels') => {
    const draft = ideaDraftMeta?.draft?.trim() || scriptText.trim();
    if (!draft) {
      setError('Generate or paste a script first so there is something to export.');
      return;
    }

    const label = platform === 'youtube' ? 'YouTube Studio' : platform === 'tiktok' ? 'TikTok' : 'Instagram Reels';
    const exportText = [
      `Platform: ${label}`,
      `Style preset: ${selectedStylePreset}`,
      '',
      'Script:',
      draft,
      '',
      'Suggested captions:',
      ...(derivedResults?.socialCaptions ?? []),
    ].join('\n');

    const element = document.createElement('a');
    const file = new Blob([exportText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = getUserScopedDownloadName(`${platform}-export`, 'txt', user?.uid);
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    trackAnalytics('exported');
  };

  const shareDraft = () => {
    const draft = ideaDraftMeta?.draft?.trim() || scriptText.trim();
    if (!draft) {
      setError('Generate a draft before sharing with teammates.');
      return;
    }

    const payload = {
      sharedAt: new Date().toISOString(),
      platform: ideaPlatform,
      stylePreset: selectedStylePreset,
      targetMinutes: ideaSections.targetMinutes,
      draft,
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied('share-draft');
    trackAnalytics('shared');
    setTimeout(() => setCopied(null), 2000);
  };

  const togglePhase = (key: string) => {
    setOpenPhases((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  };

  const tryStartClickGuard = (key: string, delay = 500) => {
    if (clickGuardTimersRef.current[key] !== undefined) {
      return false;
    }

    clickGuardTimersRef.current[key] = window.setTimeout(() => {
      delete clickGuardTimersRef.current[key];
    }, delay);

    return true;
  };

  const applyScriptPreset = (presetId: string) => {
    const preset = SCRIPT_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setSelectedPresetId(presetId);
    setIdeaSections(normalizeIdeaSectionsState({
      introduction: preset.sections.introduction,
      development: preset.sections.development,
      climax: preset.sections.climax,
      resolution: preset.sections.resolution,
      targetMinutes: preset.targetMinutes,
    }));
  };

  const ideaDraftWordRange = getTargetWordRange(ideaDraftMeta?.sections.targetMinutes ?? ideaSections.targetMinutes);
  const ideaDraftWordCount = ideaDraftMeta ? countGeneratedWords(ideaDraftMeta.draft) : 0;
  const storyboardLayers = ideaDraftMeta ? buildIdeaStoryboardLayers(ideaDraftMeta) : [];
  const activeStoryboardLayer = storyboardLayers.find((layer) => layer.id === selectedStoryLayerId) ?? storyboardLayers[0] ?? null;
  const activeResultLayer = derivedResults?.layeredArchitecture.find((layer) => layer.id === selectedResultLayerId) ?? derivedResults?.layeredArchitecture[0] ?? null;
  const storyProgressPercent = activeStoryboardLayer && ideaDraftMeta
    ? Math.min(96, Math.max(4, (parseTimestampToSeconds(activeStoryboardLayer.timestamp) / ((ideaDraftMeta.sections.targetMinutes || 15) * 60)) * 100))
    : 4;
  const errorDisplay = error ? getErrorDisplay(error) : null;

  const handleProcessYouTube = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!tryStartClickGuard('process-youtube')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await processYouTubeUrl(youtubeUrl);
      setResults(result);
      setDerivedResults(buildDerivedResults(result));
      trackAnalytics('generated');
      setError('');
    } catch (err) {
      console.error('Error processing YouTube URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to process YouTube URL. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessScript = async () => {
    if (!scriptText.trim()) {
      setError('Please enter script text');
      return;
    }

    if (!tryStartClickGuard('process-script')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await processUploadedScript(scriptText);
      setResults(result);
      setDerivedResults(buildDerivedResults(result));
      trackAnalytics('generated');
      setError('');
    } catch (err) {
      console.error('Error processing script:', err);
      setError(err instanceof Error ? err.message : 'We could not process that script right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleScriptFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const uploadError = getScriptUploadError(file);
    if (uploadError) {
      setError(uploadError);
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        setError('This file is empty. Upload a file with script text in it.');
        return;
      }

      setScriptText(text);
      setActiveTab('script');
      setError('');
    } catch (err) {
      console.error('Error reading uploaded script file:', err);
      setError('We could not read that file. Please try a plain text script file instead.');
    }
  };

  const handleCleanGeneratedContent = () => {
    setScriptText('');
    setResults(null);
    setDerivedResults(null);
    setIdeaDraftMeta(null);
    setIdeaInput('');
    setIdeaSections({ ...DEFAULT_IDEA_SECTIONS });
    setSelectedPresetId(null);
    setSelectedStoryLayerId(null);
    setSelectedResultLayerId(null);
    setActiveTranscriptTimestamp(null);
    setCopied(null);
    setError('');
    setSavedProjectId(null);
  };

  const handleGenerateIdeaDraft = async (platformOverride?: 'youtube' | 'tiktok') => {
    if (!ideaInput.trim()) {
      setError('Please enter a short idea first.');
      return;
    }

    if (!tryStartClickGuard('generate-idea-draft')) {
      return;
    }

    setIdeaLoading(true);
    setError('');

    const activePlatform = platformOverride ?? ideaPlatform;
    const styleHint = STYLE_PRESETS.find((preset) => preset.id === selectedStylePreset)?.promptHint ?? '';
    const enrichedIdea = styleHint ? `${ideaInput}\n\nStyle direction: ${styleHint}` : ideaInput;

    try {
      const draftResult = await generateIdeaDraft({
        idea: enrichedIdea,
        platform: activePlatform,
        sections: ideaSections,
      });
      const normalizedDraft = normalizeIdeaDraftMeta(draftResult, ideaSections);

      if (!hasGeneratedStoryboardContent(normalizedDraft.sections)) {
        setIdeaDraftMeta(null);
        setError('Failed to generate storyboard content. Please try again.');
        return;
      }

      setIdeaDraftMeta(normalizedDraft);
      setIdeaSections(normalizedDraft.sections);
      setScriptText(normalizedDraft.draft);
      setOpenPhases(['introduction', 'development', 'climax', 'resolution']);
      setResults(null);
      setDerivedResults(null);
      setSelectedPresetId(null);
      trackAnalytics('generated');
    } catch (err) {
      console.error('Error generating idea draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate an idea draft. Please try again.');
    } finally {
      setIdeaLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      Object.values(clickGuardTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadResults = () => {
    if (!results) return;
    const exportPayload = {
      ...results,
      LayeredArchitecture: derivedResults?.layeredArchitecture ?? [],
    };
    const jsonString = JSON.stringify(exportPayload, null, 2);
    const element = document.createElement('a');
    const file = new Blob([jsonString], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = getUserScopedDownloadName('processing-results', 'json', user?.uid, activeTab);
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSaveProject = async () => {
    if (!results || !user) return;

    if (!tryStartClickGuard('save-project')) {
      return;
    }

    setSaving(true);
    try {
      const title = derivedResults?.seo.title || results.Summary.slice(0, 60) || 'Untitled Project';
      const projectPayload = {
        sourceUrl: activeTab === 'youtube' ? youtubeUrl : undefined,
        seoTitle: derivedResults?.seo.title,
        socialCaptions: derivedResults?.socialCaptions,
      };

      console.info('[StudioPage] Persisting project', {
        mode: savedProjectId ? 'update' : 'create',
        uid: user.uid,
        projectId: savedProjectId,
        sourceType: activeTab,
      });

      if (savedProjectId) {
        await updateProject(user.uid, savedProjectId, title, activeTab, results, projectPayload);
      } else {
        const id = await saveProject(user.uid, title, activeTab, results, projectPayload);
        setSavedProjectId(id);
      }

      console.info('[StudioPage] Project persisted', {
        mode: savedProjectId ? 'update' : 'create',
        uid: user.uid,
        projectId: savedProjectId,
      });
    } catch (err) {
      console.error('Failed to save project:', err);
      setError('Failed to save project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const downloadTranscript = () => {
    if (!results?.Transcript) return;
    const element = document.createElement('a');
    const file = new Blob([results.Transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = getUserScopedDownloadName('transcript', 'txt', user?.uid, activeTab);
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-[#050508] text-slate-100 relative overflow-x-hidden">
      {/* Background ambient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="studio-hero-blob w-[600px] h-[600px] bg-emerald-600/8 top-[-120px] left-[-180px]" />
        <div className="studio-hero-blob w-[500px] h-[500px] bg-cyan-600/6 top-[30%] right-[-150px]" />
        <div className="studio-hero-blob w-[400px] h-[400px] bg-violet-600/5 bottom-[-100px] left-[30%]" />
      </div>

      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-3.5 flex justify-between items-center studio-nav">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Play className="w-4 h-4 text-black fill-current" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Video<span className="text-emerald-400">Helper</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="inline-flex flex-col h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition-all hover:bg-white/10 hover:border-cyan-400/30 px-3"
            aria-label="Settings"
          >
            <Settings2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Settings</span>
          </button>
          {user ? (
            <UserAvatarMenu />
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="inline-flex flex-col h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition-all hover:bg-white/10 hover:border-pink-400/30 px-3"
              aria-label="Sign In"
            >
              <User className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Sign In</span>
            </button>
          )}
          <button
            onClick={() => navigate('/creator-lab')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-full text-emerald-300 hover:border-emerald-400/50 hover:from-emerald-500/30 hover:to-cyan-500/30 transition-all text-sm font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Thumbnail Editor
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          {/* Hero badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 mb-5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300 tracking-wide">AI-Powered Content Suite</span>
          </div>
          <h1 className="text-5xl font-black mb-3 tracking-tight leading-[1.1]">
            <span className="studio-gradient-text">Your Idea</span>{' '}
            <span className="text-white">Becomes a Full Video</span>
          </h1>
          <p className="text-slate-300 text-base max-w-2xl leading-relaxed">
            One click turns your rough concept into a polished YouTube or TikTok video workflow: script, chapters, highlights, SEO, captions, and share-ready upload copy.
          </p>
          <p className="mt-4 text-slate-400 text-sm max-w-2xl leading-relaxed">
            VideoHelper is the creator’s smartest studio — built to turn every idea into a higher-performing video, faster.
          </p>

        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] border border-white/8 rounded-2xl p-1.5 w-fit">
          <button
            onClick={() => setIsIdeaModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border border-blue-500/35 bg-gradient-to-r from-blue-600/30 to-slate-950/80 text-blue-200 hover:border-blue-400/55 hover:from-blue-500/35 hover:to-black"
          >
            <Lightbulb className="w-4 h-4" />
            ✨ Idea
          </button>
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'youtube'
                ? 'studio-tab-active text-emerald-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Youtube className="w-4 h-4" />
            YouTube URL
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'script'
                ? 'studio-tab-active text-emerald-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            Script Text
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-1 h-fit"
          >
            <div className="studio-card rounded-2xl p-6">
              <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-300">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Input
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Idea in. Full YouTube + TikTok video package out. Keep everything in one clean flow.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">Script</span>
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-300">Chapters</span>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-violet-300">SEO</span>
                </div>
              </div>

              {activeTab === 'youtube' ? (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-slate-200">
                      YouTube URL
                    </label>
                  </div>
                  <div className="studio-input-glow rounded-xl overflow-hidden">
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleProcessYouTube}
                    disabled={loading}
                    className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Youtube className="w-4 h-4" />
                        Process YouTube
                      </>
                    )}
                  </button>
                  <p className="mt-3 text-xs text-slate-500">
                    Or use ✨ Idea to generate a YouTube or TikTok draft and continue in the Script Text tab.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-slate-200">
                      Script or Text Content
                    </label>
                    <>
                      <input
                        ref={scriptFileInputRef}
                        type="file"
                        accept=".txt,.md,.markdown,.json,.csv,.srt,.vtt"
                        className="hidden"
                        onChange={handleScriptFileSelection}
                      />
                      <button
                        type="button"
                        onClick={() => scriptFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Script File
                      </button>
                    </>
                  </div>
                  <div className="studio-input-glow rounded-xl overflow-hidden">
                    <textarea
                      value={scriptText}
                      onChange={(e) => setScriptText(e.target.value)}
                      placeholder="Paste your script or text here..."
                      className="w-full h-64 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 transition-colors resize-none"
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Use ✨ Idea to turn a short concept into an editable YouTube or TikTok draft, then refine it here.
                  </p>
                  {ideaDraftMeta && (
                    <div className="mt-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-yellow-500/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-200">Draft inserted into the script editor</p>
                          <p className="text-xs text-amber-100/80">
                            Source: {formatIdeaDraftSource(ideaDraftMeta.source)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full border border-amber-400/30 px-2 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-300">
                            {ideaDraftMeta.validation.sentenceCount} sentence{ideaDraftMeta.validation.sentenceCount === 1 ? '' : 's'}
                          </span>
                          <span className="text-[11px] text-amber-100/80">
                            {ideaDraftWordCount} words generated, target {ideaDraftWordRange.min}-{ideaDraftWordRange.max}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {ideaDraftMeta.validation.sectionValidations.map((sectionValidation) => (
                          <div
                            key={sectionValidation.section}
                            className={`rounded-xl border p-3 ${
                              sectionValidation.isValid
                                ? 'border-emerald-500/30 bg-emerald-500/10'
                                : sectionValidation.wordCount >= Math.max(8, Math.floor(sectionValidation.minimumWords * 0.65))
                                  ? 'border-amber-500/30 bg-amber-500/10'
                                  : 'border-rose-500/30 bg-rose-500/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${
                                sectionValidation.isValid
                                  ? 'text-emerald-200'
                                  : sectionValidation.wordCount >= Math.max(8, Math.floor(sectionValidation.minimumWords * 0.65))
                                    ? 'text-amber-200'
                                    : 'text-rose-200'
                              }`}>{sectionValidation.section}</p>
                              <span className={`text-[11px] ${
                                sectionValidation.isValid
                                  ? 'text-emerald-100/80'
                                  : sectionValidation.wordCount >= Math.max(8, Math.floor(sectionValidation.minimumWords * 0.65))
                                    ? 'text-amber-100/80'
                                    : 'text-rose-100/80'
                              }`}>
                                {sectionValidation.wordCount}/{sectionValidation.minimumWords} words
                              </span>
                            </div>
                            {sectionValidation.issues.length > 0 ? (
                              <div className={`mt-2 space-y-1 text-xs ${
                                sectionValidation.wordCount >= Math.max(8, Math.floor(sectionValidation.minimumWords * 0.65))
                                  ? 'text-amber-100/90'
                                  : 'text-rose-100/90'
                             }`}>
                                {sectionValidation.issues.map((issue) => (
                                  <p key={issue}>{issue}</p>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-emerald-200">Enough detail for this section.</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-amber-400/20 bg-black/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">Timeline</p>
                        <div className="mt-3 grid gap-2 md:grid-cols-5">
                          {ideaDraftMeta.timeline.map((item) => (
                            <div key={item.label} className="rounded-lg bg-black/10 p-2">
                              <p className="text-xs font-semibold text-amber-100">{item.label}</p>
                              <p className="text-[11px] text-amber-300 mt-1">{item.minutes} min</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl border border-amber-400/20 bg-black/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">Immersive cues</p>
                        <div className="mt-3 space-y-3">
                          {ideaDraftMeta.cues.map((cue) => (
                            <div key={cue.section} className="rounded-lg bg-black/10 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">{cue.section}</p>
                              <p className="mt-2 text-xs text-amber-50">Visuals: {cue.visuals.join(' | ')}</p>
                              <p className="mt-1 text-xs text-amber-50">Sound: {cue.sounds.join(' | ')}</p>
                              <p className="mt-1 text-xs text-amber-300">Emotion: {cue.emotionalBeat}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {ideaDraftMeta.validation.issues.length > 0 && (
                        <div className="mt-3 text-xs text-amber-100/90 space-y-1">
                          {ideaDraftMeta.validation.issues.map((issue) => (
                            <p key={issue}>{issue}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={handleProcessScript}
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          Process Script
                        </>
                      )}
                    </button>
                    {(results || scriptText.trim() || ideaDraftMeta) && (
                      <button
                        type="button"
                        onClick={handleCleanGeneratedContent}
                        className="px-4 py-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 font-semibold transition-colors hover:bg-rose-500/20 flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Clean
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error && errorDisplay && (
                <div className={`mt-4 rounded-2xl border p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${errorDisplay.accent}`} role="alert" aria-live="polite">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-black/20 p-2">
                      <AlertTriangle className={`h-4 w-4 ${errorDisplay.icon}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{errorDisplay.title}</p>
                          <p className="mt-1 text-sm leading-relaxed">{error}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setError('')}
                          className="rounded-full border border-white/10 bg-black/10 p-1.5 text-current/80 transition-colors hover:bg-black/20 hover:text-white"
                          aria-label="Dismiss error message"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed opacity-80">{errorDisplay.hint}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-white/6 bg-black/20 p-4">
                <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest">Included tools</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Transcript',     color: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
                    { label: 'Chapters',       color: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
                    { label: 'AI Summary',     color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
                    { label: 'Highlights',     color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
                    { label: 'SEO',            color: 'border-green-500/30 bg-green-500/10 text-green-300' },
                    { label: 'Social Captions',color: 'border-violet-500/30 bg-violet-500/10 text-violet-300' },
                    { label: 'Layered Architecture', color: 'border-slate-500/30 bg-slate-500/10 text-slate-200' },
                  ].map((tool) => (
                    <span key={tool.label} className={`studio-tool-badge border ${tool.color}`}>
                      {tool.label}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  One click can turn your concept into organized creator assets.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Results Section */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-2"
          >
            {activeTab === 'script' && ideaDraftMeta && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#1a1307] via-slate-900 to-slate-950"
              >
                <div className="border-b border-amber-500/10 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_40%)] px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Timeline Panel</p>
                      <h3 className="mt-2 text-2xl font-bold text-white">Story rhythm for the generated script</h3>
                      <p className="mt-2 max-w-2xl text-sm text-slate-300">
                        Use this panel to feel the pacing before you process the script. It shows the time arc, section health, and immersive cues in one workspace.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/20 bg-black/20 px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">Target length</p>
                      <p className="mt-1 text-lg font-semibold text-white">{ideaDraftMeta.sections.targetMinutes} min</p>
                      <p className="mt-1 text-xs text-slate-300">{ideaDraftWordCount} words</p>
                      <p className="mt-1 text-[11px] text-amber-200">Goal {ideaDraftWordRange.min}-{ideaDraftWordRange.max}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-amber-300" />
                        <p className="text-sm font-semibold text-white">Interactive layer map</p>
                      </div>
                      <div className="timeline-board rounded-2xl border border-white/10 bg-[#1b222d]/70 p-0 overflow-hidden">
                        <div className="border-b border-white/10 bg-gradient-to-r from-slate-700/40 via-slate-700/20 to-slate-700/40 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200">Foundation → Build → Connection → Outcome → Expansion → Final</p>
                        </div>

                        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                          {storyboardLayers.map((layer) => (
                            <button
                              key={layer.id}
                              type="button"
                              onClick={() => setSelectedStoryLayerId(layer.id)}
                              className={`rounded-2xl border p-4 text-left transition-all hover:border-white/30 ${getLayerToneClasses(layer.status, activeStoryboardLayer?.id === layer.id)}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200">{layer.title}</span>
                                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-amber-200">{layer.timestamp}</span>
                              </div>
                              <p className="mt-3 text-sm font-semibold text-white">{layer.chapter}</p>
                              <p className="mt-2 text-xs leading-5 text-slate-300">{layer.purpose}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {layer.dependsOn.length > 0 ? layer.dependsOn.map((dependency) => (
                                  <span key={dependency} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">
                                    depends on {dependency.replace(/-/g, ' ')}
                                  </span>
                                )) : (
                                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">root layer</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="border-t border-white/10 px-4 py-4 bg-[#202833]/70">
                          <div className="timeline-ruler flex items-center gap-3 rounded-xl border border-white/10 bg-[#313948] px-3 py-2">
                            <div className="rounded-md bg-slate-800 px-3 py-2 text-2xl font-semibold text-white">0:00</div>
                            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-700/70">
                              <div className="absolute inset-y-0 left-[1%] w-[9%] bg-white/10" />
                              <div className="timeline-ruler-ticks absolute inset-0" />
                              <div
                                className="absolute inset-y-0 w-2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                                style={{ left: `${storyProgressPercent}%`, transform: 'translateX(-50%)' }}
                              />
                              <div className="absolute inset-y-0 right-0 w-[2%] bg-white/15" />
                            </div>
                            <div className="rounded-md bg-slate-800 px-3 py-2 text-2xl font-semibold text-white">{formatClockLabel(ideaDraftMeta.sections.targetMinutes)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <WandSparkles className="h-4 w-4 text-violet-300" />
                        <p className="text-sm font-semibold text-white">Immersive cue board</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {ideaDraftMeta.cues.map((cue) => (
                          <div key={cue.section} className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">{cue.section}</p>
                            <p className="mt-3 text-xs text-slate-200">Visuals: {cue.visuals.join(' | ')}</p>
                            <p className="mt-2 text-xs text-slate-200">Sound: {cue.sounds.join(' | ')}</p>
                            <p className="mt-2 text-xs text-violet-200">Emotion: {cue.emotionalBeat}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {activeStoryboardLayer && (
                      <div className={`rounded-2xl border p-4 ${getLayerToneClasses(activeStoryboardLayer.status, true)}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Selected layer</p>
                            <h4 className="mt-2 text-lg font-semibold text-white">{activeStoryboardLayer.title}</h4>
                          </div>
                          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-amber-200">{activeStoryboardLayer.timeLabel}</span>
                        </div>
                        <p className="mt-3 text-sm font-medium text-slate-100">{activeStoryboardLayer.chapter}</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{activeStoryboardLayer.content}</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Interaction</p>
                            <p className="mt-2 text-xs text-slate-200">{activeStoryboardLayer.interactionLabel}</p>
                            <p className="mt-2 text-xs text-violet-200">Emotion: {activeStoryboardLayer.emotionalBeat ?? 'Guided focus'}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Dependencies</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {activeStoryboardLayer.dependsOn.length > 0 ? activeStoryboardLayer.dependsOn.map((dependency) => (
                                <span key={dependency} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200">
                                  {dependency.replace(/-/g, ' ')}
                                </span>
                              )) : (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">starts the system</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Mapped content</p>
                          <p className="mt-2 text-xs text-slate-200">Visuals: {activeStoryboardLayer.visuals.join(' | ') || 'N/A'}</p>
                          <p className="mt-2 text-xs text-slate-200">Sound: {activeStoryboardLayer.sounds.join(' | ') || 'N/A'}</p>
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                        <p className="text-sm font-semibold text-white">Detail validation</p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {ideaDraftMeta.validation.sectionValidations.map((sectionValidation) => {
                          const visualState = getSectionVisualState(sectionValidation.wordCount, sectionValidation.minimumWords);

                          return (
                            <div key={sectionValidation.section} className={`rounded-2xl border p-4 ${visualState.border} ${visualState.background}`}>
                              <div className="flex items-center justify-between gap-3">
                                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${visualState.text}`}>{sectionValidation.section}</p>
                                <span className={`text-[11px] ${visualState.chip}`}>{sectionValidation.wordCount}/{sectionValidation.minimumWords} words</span>
                              </div>
                              <p className="mt-3 text-xs text-slate-200">
                                {sectionValidation.isValid ? 'This section has enough detail to sustain the pacing.' : sectionValidation.issues[0]}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {results ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">Pipeline Complete</p>
                      <p className="mt-1 text-sm font-semibold text-white">Your idea is now an organized video-ready package.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Transcript</span>
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Layers</span>
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">SEO</span>
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Captions</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Analytics hooks: {analyticsStats.generated} generated • {analyticsStats.exported} exported • {analyticsStats.shared} shared
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={shareDraft}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${copied === 'share-draft'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white'}`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {copied === 'share-draft' ? 'Shared payload copied' : 'Share Draft'}
                    </button>
                    <button
                      onClick={() => exportDraftBundle('youtube')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold text-white transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      YouTube Studio
                    </button>
                    <button
                      onClick={() => exportDraftBundle('tiktok')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold text-white transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      TikTok
                    </button>
                    <button
                      onClick={() => exportDraftBundle('reels')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold text-white transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Instagram Reels
                    </button>
                  </div>
                </div>

                {/* Download + Save Buttons */}
                <div className="flex gap-2 justify-end flex-wrap">
                  {user && (
                    <button
                      onClick={handleSaveProject}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        savedProjectId
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                          : 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 text-white disabled:opacity-60'
                      }`}
                    >
                      {saving ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</>
                      ) : savedProjectId ? (
                        <><Check className="w-3.5 h-3.5" />Update Cloud Project</>
                      ) : (
                        <><CloudUpload className="w-3.5 h-3.5" />Save to Cloud</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={downloadResults}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold text-white transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                  <button
                    onClick={downloadTranscript}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold text-white transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Transcript
                  </button>
                </div>

                {/* Live Preview of Assets */}
                {derivedResults && (
                  <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-slate-950/90 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Before Publish Preview</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs font-semibold text-white">Chapter view</p>
                        <div className="mt-2 space-y-1.5">
                          {results.Chapters.slice(0, 3).map((chapter) => (
                            <p key={chapter.id} className="text-[11px] text-slate-300">• {chapter.timestamp} {chapter.title}</p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs font-semibold text-white">SEO snippet</p>
                        <p className="mt-2 text-[11px] font-semibold text-cyan-200">{derivedResults.seo.title}</p>
                        <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">{derivedResults.seo.description.slice(0, 110)}...</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs font-semibold text-white">Caption card</p>
                        <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">{derivedResults.socialCaptions[0]}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transcript */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="studio-card studio-result-card rounded-2xl p-6"
                  ref={transcriptPanelRef}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                      </div>
                      Transcript
                    </h3>
                    <button
                      onClick={() => copyToClipboard(results.Transcript, 'transcript')}
                      className={`studio-copy-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        copied === 'transcript'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {copied === 'transcript' ? (
                        <><Check className="w-3.5 h-3.5" />Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" />Copy</>
                      )}
                    </button>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4 max-h-64 overflow-y-auto space-y-2">
                    {getTranscriptSegments(results.Transcript).map((segment, index) => {
                      const isActive = Boolean(activeTranscriptTimestamp) && segment.includes(activeTranscriptTimestamp);

                      return (
                        <div
                          key={`${segment.slice(0, 24)}-${index}`}
                          className={`rounded-lg border px-3 py-2 text-sm leading-relaxed transition-all ${
                            isActive
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                              : 'border-white/5 bg-transparent text-slate-300'
                          }`}
                        >
                          {segment}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Chapters */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="studio-card studio-result-card rounded-2xl p-6"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-purple-400" />
                      </div>
                      Chapters
                    </h3>
                    <button
                      onClick={() => copyToClipboard(results.Chapters.map((ch) => `${ch.timestamp} ${ch.title}`).join('\n'), 'chapters')}
                      className={`studio-copy-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        copied === 'chapters'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {copied === 'chapters' ? (
                        <><Check className="w-3.5 h-3.5" />Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" />Copy</>
                      )}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {results.Chapters.map((chapter, idx) => (
                      <div
                        key={chapter.id}
                        className="flex items-start gap-3 p-3 bg-black/20 border border-white/5 rounded-xl hover:bg-black/30 hover:border-white/10 transition-all"
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/25 to-violet-600/15 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{chapter.chapterName}</p>
                          <p className="text-[11px] text-purple-300/80 mt-0.5">{chapter.timeLabel}</p>
                          {chapter.summary && (
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{chapter.summary}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Layered Architecture */}
                {derivedResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="studio-card studio-result-card rounded-2xl p-6"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-base font-bold flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-500/15 border border-slate-500/25 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-slate-200" />
                          </div>
                          Layered Architecture
                        </h3>
                        <p className="mt-2 text-xs text-slate-400">Each layer now carries its own content, dependency links, and transcript jump target.</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(derivedResults.layeredArchitecture, null, 2), 'layers')}
                        className={`studio-copy-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          copied === 'layers'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {copied === 'layers' ? (
                          <><Check className="w-3.5 h-3.5" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Copy JSON</>
                        )}
                      </button>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="space-y-3">
                        {derivedResults.layeredArchitecture.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedResultLayerId(item.id);
                              setActiveTranscriptTimestamp(item.timestamp);
                            }}
                            className={`w-full rounded-xl border p-4 text-left transition-all hover:border-white/30 ${getLayerToneClasses(item.status, activeResultLayer?.id === item.id)}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <span className="text-sm font-semibold text-slate-100">{item.title}</span>
                              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-500/10 rounded-lg px-2.5 py-1">{item.timeLabel}</span>
                            </div>
                            <p className="text-sm text-white/90">{item.chapter}</p>
                            <p className="mt-2 text-xs text-slate-400">{item.purpose}</p>
                          </button>
                        ))}
                      </div>

                      {activeResultLayer && (
                        <div className={`rounded-2xl border p-4 ${getLayerToneClasses(activeResultLayer.status, true)}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Selected layer</p>
                              <h4 className="mt-2 text-lg font-semibold text-white">{activeResultLayer.title}</h4>
                            </div>
                            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-amber-200">{activeResultLayer.timestamp}</span>
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-100">{activeResultLayer.chapter}</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-300">{activeResultLayer.content}</p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Dependencies</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {activeResultLayer.dependsOn.length > 0 ? activeResultLayer.dependsOn.map((dependency) => (
                                  <span key={dependency} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200">
                                    {dependency.replace(/-/g, ' ')}
                                  </span>
                                )) : (
                                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">root layer</span>
                                )}
                              </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Interaction</p>
                              <p className="mt-2 text-xs text-slate-200">{activeResultLayer.interactionLabel}</p>
                              <p className="mt-2 text-xs text-violet-200">Emotion: {activeResultLayer.emotionalBeat}</p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Mapped assets</p>
                            <p className="mt-2 text-xs text-slate-200">Visuals: {activeResultLayer.visuals.join(' | ')}</p>
                            <p className="mt-2 text-xs text-slate-200">Sound: {activeResultLayer.sounds.join(' | ')}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTranscriptTimestamp(activeResultLayer.timestamp);
                              transcriptPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-400/50"
                          >
                            <Clock3 className="h-3.5 w-3.5" />
                            Jump to transcript timestamp
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="studio-card studio-result-card rounded-2xl p-6"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                      </div>
                      AI Summary
                    </h3>
                    <button
                      onClick={() => copyToClipboard(results.Summary, 'summary')}
                      className={`studio-copy-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        copied === 'summary'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {copied === 'summary' ? (
                        <><Check className="w-3.5 h-3.5" />Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" />Copy</>
                      )}
                    </button>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-950/30 to-black/20 border border-emerald-500/10 rounded-xl p-4">
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {results.Summary}
                    </p>
                  </div>
                </motion.div>

                {/* Highlights */}
                {derivedResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="studio-card studio-result-card rounded-2xl p-6"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-base font-bold flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                          <Target className="w-4 h-4 text-amber-400" />
                        </div>
                        Highlight Finder
                      </h3>
                      <button
                        onClick={() => copyToClipboard(derivedResults.highlights.map((highlight) => `${highlight.timestamp} ${highlight.title}`).join('\n'), 'highlights')}
                        className={`studio-copy-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          copied === 'highlights'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {copied === 'highlights' ? (
                          <><Check className="w-3.5 h-3.5" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Copy</>
                        )}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {derivedResults.highlights.map((highlight, idx) => (
                        <div key={`${highlight.timestamp}-${idx}`} className="rounded-xl bg-gradient-to-r from-amber-950/30 to-black/20 p-4 border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-sm font-mono font-bold text-amber-300 bg-amber-500/10 rounded-lg px-2.5 py-1">{highlight.timestamp}</span>
                            <div className="flex items-center gap-2">
                              <div className="studio-score-bar w-16" style={{ opacity: highlight.score / 100 }} />
                              <span className="text-xs font-bold text-amber-400">{highlight.score}%</span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-200 leading-relaxed">{highlight.title}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* SEO */}
                {derivedResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="studio-card studio-result-card rounded-2xl p-6"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-base font-bold flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                          <Hash className="w-4 h-4 text-green-400" />
                        </div>
                        SEO Pack
                      </h3>
                      <button
                        onClick={() => copyToClipboard(`${derivedResults.seo.title}\n\n${derivedResults.seo.description}\n\n${derivedResults.seo.keywords.join(', ')}`, 'seo')}
                        className={`studio-copy-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          copied === 'seo'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {copied === 'seo' ? (
                          <><Check className="w-3.5 h-3.5" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Copy</>
                        )}
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl bg-black/30 border border-white/5 p-4">
                        <p className="studio-chip-label text-green-500/70 mb-2">Title</p>
                        <p className="text-sm text-slate-100 font-medium">{derivedResults.seo.title}</p>
                      </div>
                      <div className="rounded-xl bg-black/30 border border-white/5 p-4">
                        <p className="studio-chip-label text-green-500/70 mb-2">Description</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{derivedResults.seo.description}</p>
                      </div>
                      <div className="rounded-xl bg-black/30 border border-white/5 p-4">
                        <p className="studio-chip-label text-green-500/70 mb-3">Keywords</p>
                        <div className="flex flex-wrap gap-2">
                          {derivedResults.seo.keywords.map((keyword) => (
                            <span key={keyword} className="studio-keyword-chip rounded-full px-3 py-1 text-xs font-semibold cursor-default">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Social Captions */}
                {derivedResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="studio-card studio-result-card rounded-2xl p-6"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-base font-bold flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                          <Share2 className="w-4 h-4 text-violet-400" />
                        </div>
                        Social Captions
                      </h3>
                      <button
                        onClick={() => copyToClipboard(derivedResults.socialCaptions.join('\n\n'), 'captions')}
                        className={`studio-copy-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          copied === 'captions'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {copied === 'captions' ? (
                          <><Check className="w-3.5 h-3.5" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Copy</>
                        )}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {derivedResults.socialCaptions.map((caption, idx) => (
                        <div key={idx} className="rounded-xl bg-gradient-to-br from-violet-950/25 to-black/20 border border-violet-500/10 hover:border-violet-500/20 transition-colors p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="studio-chip-label text-violet-400/70">Caption {idx + 1}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap text-slate-200 leading-relaxed">{caption}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : loading ? (
              <LoadingMiniGame message="Processing content…" color="emerald" />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="studio-card rounded-2xl p-12 border-dashed flex items-center justify-center min-h-96"
              >
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5 studio-idle-icon">
                    <Sparkles className="w-9 h-9 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Ready when you are
                  </h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                    {activeTab === 'youtube'
                      ? 'Paste one URL and let Tubeflow organize everything into transcript, chapters, highlights, and SEO in one run.'
                      : 'Drop your draft and convert it into clean, publish-ready assets with one click.'}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Creator Stories */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-8 mt-12 rounded-3xl border border-white/10 bg-black/20 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Success stories</p>
              <h3 className="mt-1 text-xl font-bold text-white">Creators shipping faster with TubeFlow</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStoryIndex((current) => (current - 1 + CREATOR_STORIES.length) % CREATOR_STORIES.length)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setStoryIndex((current) => (current + 1) % CREATOR_STORIES.length)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Next
              </button>
            </div>
          </div>

          <div className={`mt-4 grid gap-4 rounded-2xl border border-white/10 bg-gradient-to-br ${CREATOR_STORIES[storyIndex].gradient} p-4 lg:grid-cols-[180px_1fr]`}>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="aspect-video rounded-lg border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.25),transparent_45%)]" />
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Video thumbnail</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm leading-relaxed text-slate-100">"{CREATOR_STORIES[storyIndex].quote}"</p>
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm font-semibold text-white">{CREATOR_STORIES[storyIndex].creator}</p>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                  {CREATOR_STORIES[storyIndex].metric}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14 mb-12"
        >
          {[
            {
              icon: MessageSquare,
              color: 'text-blue-400',
              bg: 'from-blue-500/15 to-blue-600/8',
              border: 'border-blue-500/20',
              title: 'Smart Transcripts',
              desc: 'Accurate transcripts with timestamps for both YouTube videos and scripts',
            },
            {
              icon: FileText,
              color: 'text-purple-400',
              bg: 'from-purple-500/15 to-purple-600/8',
              border: 'border-purple-500/20',
              title: 'Auto Chapters',
              desc: 'Automatically generate chapter timestamps and titles for better organization',
            },
            {
              icon: Sparkles,
              color: 'text-emerald-400',
              bg: 'from-emerald-500/15 to-emerald-600/8',
              border: 'border-emerald-500/20',
              title: 'AI Summaries',
              desc: 'Get concise, comprehensive summaries of your content in seconds',
            },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className={`studio-card rounded-2xl p-5 border hover:scale-[1.01] transition-transform ${feat.border}`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feat.bg} border ${feat.border} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${feat.color}`} />
                </div>
                <h4 className="font-bold text-white mb-1.5">{feat.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </motion.div>
      </div>

      {isIdeaModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#09090f] shadow-2xl shadow-black/60"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-4 bg-gradient-to-r from-amber-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/30 to-yellow-500/20 border border-amber-400/25 flex items-center justify-center">
                  <Lightbulb className="h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-400/70">Idea Draft</p>
                  <h2 className="text-base font-bold text-white leading-tight">Turn a short idea into a script draft</h2>
                </div>
              </div>
              <button
                onClick={() => setIsIdeaModalOpen(false)}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white/8 hover:text-white"
                aria-label="Close idea modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Two-panel body */}
            <div className="flex flex-1 min-h-0 flex-col lg:flex-row">

              {/* ── LEFT: Input Panel ── */}
              <div className="flex flex-col gap-4 overflow-y-auto border-b border-white/10 p-5 lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r">

                {/* Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 mr-1">Preset:</span>
                  {SCRIPT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyScriptPreset(preset.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedPresetId === preset.id
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/10 bg-slate-900 text-slate-300 hover:border-white/20 hover:text-white'
                      }`}
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                {/* Idea textarea */}
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-slate-900 to-slate-950 p-4">
                  <label className="text-sm font-semibold text-slate-200">Your idea</label>
                  <textarea
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    placeholder="Example: I want a short video explaining how creators can turn long YouTube videos into clips, captions, and SEO assets faster."
                    className="mt-2 h-28 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-amber-400 resize-none"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>1–2 sentences with a clear topic and outcome.</span>
                    <span>{ideaInput.trim().split(/\s+/).filter(Boolean).length} words</span>
                  </div>

                  {/* AI analysis panel */}
                  {ideaInput.trim().length > 0 && (() => {
                    if (ideaPlatform === 'tiktok') {
                      return (
                        <div className="mt-3 rounded-2xl border border-pink-500/20 bg-pink-500/5 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4 text-pink-300" />
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">TikTok Script Format</p>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { label: '🎬 Hook', sub: '0–3 sec', color: 'text-pink-300' },
                              { label: '🪄 Value', sub: '4–45 sec', color: 'text-purple-300' },
                              { label: '🎯 CTA', sub: 'last 5 sec', color: 'text-fuchsia-300' },
                            ].map((s) => (
                              <div key={s.label} className="rounded-xl border border-white/8 bg-slate-900/60 px-2 py-1.5 text-center">
                                <p className={`text-[10px] font-bold leading-tight ${s.color}`}>{s.label}</p>
                                <p className="text-[9px] text-slate-500 mt-0.5">{s.sub}</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] text-slate-400">80–120 words · energetic, casual, scroll-stopping</p>
                        </div>
                      );
                    }
                    const target = getScriptWordTarget(ideaSections.targetMinutes);
                    const { min, max } = getTargetWordRange(ideaSections.targetMinutes);
                    const phases = [
                      { label: 'Initial Concept', pct: '10%', words: Math.round(target * 0.1) },
                      { label: 'Develop Story',   pct: '35%', words: Math.round(target * 0.35) },
                      { label: 'Key Moment',      pct: '35%', words: Math.round(target * 0.35) },
                      { label: 'Wrap Up',         pct: '20%', words: Math.round(target * 0.2) },
                    ];
                    return (
                      <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-amber-300" />
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">AI Script Analysis</p>
                        </div>
                        <p className="text-sm text-slate-200">
                          <span className="font-bold text-amber-300">{ideaSections.targetMinutes} min</span>
                          {' → '}
                          <span className="font-bold text-white">~{target.toLocaleString()} words</span>
                          <span className="text-slate-400 text-xs"> ({min.toLocaleString()}–{max.toLocaleString()})</span>
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {phases.map((phase) => (
                            <div key={phase.label} className="rounded-xl border border-white/8 bg-slate-900/60 px-2 py-1.5 flex items-center justify-between gap-2">
                              <p className="text-[9px] uppercase tracking-[0.12em] text-amber-300/80 leading-tight">{phase.label}</p>
                              <p className="text-xs font-bold text-white">~{phase.words.toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Duration + Platform + Generate */}
                  <div className="mt-4 flex flex-col gap-2">
                    {/* Minutes bar — hidden for TikTok */}
                    {ideaPlatform === 'youtube' && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-300/90">
                          YouTube Script Duration
                        </p>
                        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900 p-1 self-start">
                        {[8, 10, 15, 20].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setIdeaSections((c) => ({ ...c, targetMinutes: m }))}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              ideaSections.targetMinutes === m
                                ? 'bg-amber-500 text-black'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            {m}m
                          </button>
                        ))}
                        </div>
                      </div>
                    )}
                    {ideaPlatform === 'tiktok' && (
                      <p className="text-[11px] text-pink-400 px-1">Short-form · hook in 3 sec · ~45–60 s script</p>
                    )}

                    {/* Platform toggle */}
                    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900 p-1 self-start">
                      <button
                        type="button"
                        onClick={() => {
                          setIdeaPlatform('youtube');
                          if (ideaDraftMeta && ideaInput.trim()) handleGenerateIdeaDraft('youtube');
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          ideaPlatform === 'youtube'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        YouTube
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIdeaPlatform('tiktok');
                          if (ideaDraftMeta && ideaInput.trim()) handleGenerateIdeaDraft('tiktok');
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          ideaPlatform === 'tiktok'
                            ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.26 8.26 0 0 0 4.83 1.55V6.79a4.85 4.85 0 0 1-1.06-.1z"/>
                        </svg>
                        TikTok
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Pick your style</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {STYLE_PRESETS.map((preset) => {
                          const Icon = preset.icon;
                          const isSelected = selectedStylePreset === preset.id;

                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setSelectedStylePreset(preset.id)}
                              className={`rounded-xl border bg-gradient-to-br p-2.5 text-left transition-all ${isSelected
                                ? `${preset.accent} ring-1 ring-white/20`
                                : 'border-white/10 from-slate-800 to-slate-900 text-slate-300 hover:border-white/20'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${isSelected ? 'bg-black/20' : 'bg-black/30'}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="text-xs font-semibold">{preset.name}</span>
                              </div>
                              <p className="mt-1 text-[10px] leading-relaxed opacity-85">{preset.hint}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-3 ${ideaPlatform === 'youtube' ? 'border-red-500/20 bg-red-500/5' : 'border-pink-500/20 bg-pink-500/5'}`}>
                      {ideaPlatform === 'youtube' ? (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">YouTube Generator Mode</p>
                          <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                            "From one idea to a full {ideaSections.targetMinutes}-minute YouTube script with story flow, retention hooks, and a strong CTA."
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pink-300">TikTok Generator Mode</p>
                          <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                            "Turn one topic into a punchy short: hook fast, deliver value quickly, and close with a scroll-stopping CTA."
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateIdeaDraft()}
                        disabled={ideaLoading || !ideaInput.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        {ideaLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Lightbulb className="h-4 w-4" />
                            Generate script
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIdeaInput('');
                          setIdeaDraftMeta(null);
                          setIdeaSections({ ...DEFAULT_IDEA_SECTIONS });
                          setSelectedStylePreset('educational');
                          setSelectedPresetId(null);
                          setError(null);
                        }}
                        disabled={ideaLoading || (!ideaInput.trim() && !ideaDraftMeta)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-400 hover:text-white disabled:border-slate-700 disabled:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Result Panel ── */}
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <WandSparkles className={`h-4 w-4 ${ideaPlatform === 'tiktok' ? 'text-pink-300' : 'text-amber-300'}`} />
                    <p className="text-sm font-semibold text-white">Generated Script</p>
                    {ideaDraftMeta && (
                      <span className="text-[11px] text-slate-400 ml-1">
                        {ideaDraftWordCount.toLocaleString()} words
                        {ideaPlatform === 'youtube' && <> · {ideaDraftMeta.sections.targetMinutes} min</>}
                      </span>
                    )}
                  </div>
                  {ideaDraftMeta && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(ideaDraftMeta.draft);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                      <Copy className="h-3 w-3" />
                      Copy all
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {!ideaDraftMeta && !ideaLoading && (
                    ideaPlatform === 'tiktok' ? (
                      /* TikTok guide in place of blank state */
                      <div className="flex h-full flex-col justify-center gap-4 px-2">
                        <div className="flex items-center gap-2">
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-pink-400" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.26 8.26 0 0 0 4.83 1.55V6.79a4.85 4.85 0 0 1-1.06-.1z"/>
                          </svg>
                          <p className="text-sm font-bold text-pink-300">How a TikTok Script Should Look</p>
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">🎬</span>
                              <span className="text-sm font-bold text-pink-300">Hook (0–3 sec)</span>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">Grab attention instantly — curiosity, shock, or a bold claim.</p>
                            <p className="text-xs text-slate-500 italic">"Stop scrolling — here's why junk food is secretly draining your energy…"</p>
                          </div>

                          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">🪄</span>
                              <span className="text-sm font-bold text-purple-300">Middle — Quick Value</span>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">1–2 fast, visual, digestible points. Short sentences only.</p>
                            <p className="text-xs text-slate-500 italic">"That bag of chips? Instant sugar spike. Then boom — energy crash."</p>
                          </div>

                          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">🎯</span>
                              <span className="text-sm font-bold text-fuchsia-300">End — CTA / Punchline</span>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">Wrap with a takeaway or call-to-action. Make it memorable.</p>
                            <p className="text-xs text-slate-500 italic">"Swap chips for nuts — your body will thank you."</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-3">
                          <p className="text-[11px] font-bold text-slate-300 mb-1.5">Drafting Rules</p>
                          <ul className="space-y-1 text-[11px] text-slate-400">
                            <li><span className="text-pink-400">→</span> <span className="text-slate-300 font-semibold">Length:</span> 15–30 sec (80–120 words)</li>
                            <li><span className="text-pink-400">→</span> <span className="text-slate-300 font-semibold">Tone:</span> Energetic, casual, direct</li>
                            <li><span className="text-pink-400">→</span> <span className="text-slate-300 font-semibold">Structure:</span> Hook → Value → CTA</li>
                            <li><span className="text-pink-400">→</span> <span className="text-slate-300 font-semibold">Cues:</span> Add stage directions e.g. [show chips]</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <div className="rounded-full border border-white/10 bg-slate-900 p-4">
                          <WandSparkles className="h-8 w-8 text-slate-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-400">Your script will appear here</p>
                        <p className="text-xs text-slate-500 max-w-xs">Type your idea on the left, choose a duration, and hit Generate script.</p>
                      </div>
                    )
                  )}

                  {ideaLoading && (
                    <LoadingMiniGame message="Generating your script…" color="yellow" />
                  )}

                  {ideaDraftMeta && !ideaLoading && hasGeneratedStoryboardContent(ideaDraftMeta.sections) && (
                    <div className="space-y-3">
                      {(ideaPlatform === 'tiktok'
                        ? ([
                            { key: 'introduction' as const, title: '🎬 Hook',        icon: Lightbulb,     accent: 'text-pink-300',    border: 'border-pink-500/20',    headerBg: 'bg-pink-500/8' },
                            { key: 'development' as const,  title: '🪄 Quick Value', icon: FileText,      accent: 'text-purple-300',  border: 'border-purple-500/20', headerBg: 'bg-purple-500/8' },
                            { key: 'resolution' as const,   title: '🎯 CTA',         icon: CircleCheckBig, accent: 'text-fuchsia-300', border: 'border-fuchsia-500/20', headerBg: 'bg-fuchsia-500/8' },
                          ] as const)
                        : ([
                            { key: 'introduction' as const, title: 'Initial Concept', icon: Lightbulb,     accent: 'text-amber-300',   border: 'border-amber-500/20',   headerBg: 'bg-amber-500/8' },
                            { key: 'development' as const,  title: 'Develop Story',   icon: FileText,      accent: 'text-sky-300',     border: 'border-sky-500/20',     headerBg: 'bg-sky-500/8' },
                            { key: 'climax' as const,       title: 'Key Moment',      icon: Flag,          accent: 'text-rose-300',    border: 'border-rose-500/20',    headerBg: 'bg-rose-500/8' },
                            { key: 'resolution' as const,   title: 'Wrap Up',         icon: CircleCheckBig, accent: 'text-emerald-300', border: 'border-emerald-500/20', headerBg: 'bg-emerald-500/8' },
                          ] as const)
                      ).map((phase) => {
                        const Icon = phase.icon;
                        const text = ideaDraftMeta.sections[phase.key] ?? '';
                        const isOpen = openPhases.includes(phase.key);
                        const wordCount = countGeneratedWords(text);
                        return (
                          <div key={phase.key} className={`rounded-2xl border ${phase.border} bg-slate-900 overflow-hidden`}>
                            <button
                              type="button"
                              onClick={() => togglePhase(phase.key)}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:brightness-110 ${phase.headerBg}`}
                            >
                              <Icon className={`h-4 w-4 flex-shrink-0 ${phase.accent}`} />
                              <span className="flex-1 text-sm font-semibold text-white">{phase.title}</span>
                              {ideaPlatform === 'youtube' && (
                                <span className="text-[11px] text-slate-400">{formatPhaseTimingLabel(ideaDraftMeta.sections.targetMinutes, phase.key)}</span>
                              )}
                              <span className="text-[11px] text-slate-500 ml-1">{wordCount.toLocaleString()} words</span>
                              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && (
                              <div className="border-t border-white/5 px-5 pb-5 pt-4 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                                {text || <span className="italic text-slate-500">No content generated for this phase.</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-white/8 bg-black/20 px-6 py-3.5">
              <button
                onClick={() => setIsIdeaModalOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
              {ideaDraftMeta && (
                <button
                  onClick={() => {
                    setIsIdeaModalOpen(false);
                    setActiveTab('script');
                    setIdeaDraftMeta(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-2 text-sm font-bold text-black transition-all shadow-lg shadow-emerald-500/25"
                >
                  <ChevronRight className="h-4 w-4" />
                  Proceed to Script
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StudioPage;
