import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Youtube,
  Upload,
  MessageSquare,
  Copy,
  Check,
  Loader2,
  Download,
  Sparkles,
  Settings2,
  Play,
  FileText,
  LogIn,
  Zap,
  Hash,
  Share2,
  Target,
  Lightbulb,
  X,
  Clock3,
  AlertTriangle,
  WandSparkles,
  Flag,
  CircleCheckBig,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { generateIdeaDraft, IdeaDraftResponse, processYouTubeUrl, processUploadedScript, ProcessingResult } from '../services/geminiService';

interface DerivedStudioResults {
  highlights: { timestamp: string; title: string; score: number }[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  socialCaptions: string[];
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'this', 'that', 'these', 'those', 'into', 'about', 'your', 'their',
  'them', 'then', 'than', 'what', 'when', 'where', 'while', 'which', 'who', 'why', 'how'
]);

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

const DEFAULT_IDEA_SECTIONS = {
  introduction: '',
  development: '',
  climax: '',
  resolution: '',
  targetMinutes: 15,
};

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
    source: response?.source === 'huggingface' ? 'huggingface' : 'local-nlp',
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
  const ranges = [
    '1-2 min',
    '3-5 min',
    '4-5 min',
    '2-3 min',
  ];

  if (totalMinutes === 15 && ranges[index]) {
    return ranges[index];
  }

  if (minutes <= 1) {
    return '1 min';
  }

  return `${Math.max(1, minutes - 1)}-${minutes} min`;
}

function formatClockLabel(totalMinutes: number) {
  return `${String(totalMinutes).padStart(2, '0')}:00`;
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

function buildDerivedResults(results: ProcessingResult): DerivedStudioResults {
  const keywords = extractKeywords(`${results.Transcript} ${results.Summary}`);
  const transcriptLines = results.Transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fallbackHighlights = results.Chapters.slice(0, 4).map((chapter, index) => ({
    timestamp: chapter.split(' ')[0] || `0${index}:00`,
    title: chapter.replace(/^\S+\s*/, '') || `Highlight ${index + 1}`,
    score: Math.max(78, 96 - index * 5),
  }));

  const transcriptHighlights = transcriptLines.slice(0, 4).map((line, index) => {
    const timestampMatch = line.match(/\[?(\d{2}:\d{2})\]?/);
    const timestamp = timestampMatch?.[1] || results.Chapters[index]?.split(' ')[0] || `0${index}:00`;
    const cleanLine = line.replace(/\[?\d{2}:\d{2}\]?\s*/, '');

    return {
      timestamp,
      title: cleanLine.slice(0, 90) || `Highlight ${index + 1}`,
      score: Math.max(80, 95 - index * 4),
    };
  });

  const descriptionBase = results.Summary.replace(/\s+/g, ' ').trim();

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
      `Built with VideoHelper: ${results.Chapters.slice(0, 2).join(' | ')}`,
    ],
  };
}

const StudioPage = () => {
  const navigate = useNavigate();
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
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const updateIdeaSection = (field: 'introduction' | 'development' | 'climax' | 'resolution', value: string) => {
    setIdeaSections((current) => ({ ...current, [field]: value }));
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

  const liveSectionStates = {
    introduction: getSectionVisualState(countSectionWords(ideaSections.introduction), IDEA_SECTION_MINIMUMS.introduction),
    development: getSectionVisualState(countSectionWords(ideaSections.development), IDEA_SECTION_MINIMUMS.development),
    climax: getSectionVisualState(countSectionWords(ideaSections.climax), IDEA_SECTION_MINIMUMS.climax),
    resolution: getSectionVisualState(countSectionWords(ideaSections.resolution), IDEA_SECTION_MINIMUMS.resolution),
  };

  const handleProcessYouTube = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await processYouTubeUrl(youtubeUrl);
      setResults(result);
      setDerivedResults(buildDerivedResults(result));
      setError('');
    } catch (err) {
      console.error('Error processing YouTube URL:', err);
      setError('Failed to process YouTube URL. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessScript = async () => {
    if (!scriptText.trim()) {
      setError('Please enter script text');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await processUploadedScript(scriptText);
      setResults(result);
      setDerivedResults(buildDerivedResults(result));
      setError('');
    } catch (err) {
      console.error('Error processing script:', err);
      setError('Failed to process script. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIdeaDraft = async () => {
    if (!ideaInput.trim()) {
      setError('Please enter a short idea first.');
      return;
    }

    setIdeaLoading(true);
    setError('');

    try {
      const draftResult = await generateIdeaDraft({
        idea: ideaInput,
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
      setResults(null);
      setDerivedResults(null);
      setSelectedPresetId(null);
    } catch (err) {
      console.error('Error generating idea draft:', err);
      setError('Failed to generate an idea draft. Please try again.');
    } finally {
      setIdeaLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadResults = () => {
    if (!results) return;
    const jsonString = JSON.stringify(results, null, 2);
    const element = document.createElement('a');
    const file = new Blob([jsonString], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = 'processing-results.json';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadTranscript = () => {
    if (!results?.Transcript) return;
    const element = document.createElement('a');
    const file = new Blob([results.Transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'transcript.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100 p-6">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Play className="w-5 h-5 text-black fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Video<span className="text-emerald-500">Helper</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <LogIn className="w-4 h-4" />
            Login
          </button>
          <button
            onClick={() => navigate('/creator-lab')}
            className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4" />
            Creator Lab
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-1 px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Sparkles className="w-10 h-10 text-emerald-500" />
            Content Studio
          </h1>
          <p className="text-slate-400">
            Keep everything on one page: enter a YouTube URL or script text and get all tool outputs below.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-white/10 rounded-t-xl overflow-hidden bg-black/30">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex-1 px-6 py-4 font-semibold transition-all ${
              activeTab === 'youtube'
                ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Youtube className="w-5 h-5" />
              YouTube URL
            </div>
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`flex-1 px-6 py-4 font-semibold transition-all ${
              activeTab === 'script'
                ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              Script Text
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10 h-fit"
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" />
                Input
              </h2>

              {activeTab === 'youtube' ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-slate-300">
                      YouTube URL
                    </label>
                    <button
                      onClick={() => setIsIdeaModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                    >
                      <Lightbulb className="h-4 w-4" />
                      ✨ Idea
                    </button>
                  </div>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-3 bg-slate-700 border border-white/10 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={handleProcessYouTube}
                    disabled={loading}
                    className="w-full mt-4 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
                  <p className="mt-2 text-xs text-slate-400">
                    Or use ✨ Idea to generate a draft and continue in the Script Text tab.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-slate-300">
                      Script or Text Content
                    </label>
                    <button
                      onClick={() => setIsIdeaModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                    >
                      <Lightbulb className="h-4 w-4" />
                      ✨ Idea
                    </button>
                  </div>
                  <textarea
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Paste your script or text here..."
                    className="w-full h-64 px-4 py-3 bg-slate-700 border border-white/10 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Use ✨ Idea to turn a short concept into an editable draft, then refine it here before processing.
                  </p>
                  {ideaDraftMeta && (
                    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-200">Draft inserted into the script editor</p>
                          <p className="text-xs text-amber-100/80">
                            Source: {ideaDraftMeta.source === 'huggingface' ? 'Hugging Face expansion' : 'Local NLP fallback'}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-400/30 px-2 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-300">
                          {ideaDraftMeta.validation.sentenceCount} sentence{ideaDraftMeta.validation.sentenceCount === 1 ? '' : 's'}
                        </span>
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
                  <button
                    onClick={handleProcessScript}
                    disabled={loading}
                    className="w-full mt-4 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <h3 className="text-sm font-semibold text-white mb-2">Included tools on this page</h3>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">Transcript</span>
                  <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1">Auto Chapters</span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">AI Summary</span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">Highlight Finder</span>
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1">SEO</span>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1">Social Captions</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Results Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
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
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.3fr_0.9fr]">
                  <div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-amber-300" />
                        <p className="text-sm font-semibold text-white">Dedicated timeline</p>
                      </div>
                      <div className="timeline-board rounded-2xl border border-white/10 bg-[#1b222d]/70 p-0 overflow-hidden">
                        <div className="timeline-phase-row grid grid-cols-4 border-b border-white/10 bg-gradient-to-r from-slate-700/40 via-slate-700/20 to-slate-700/40">
                          {[
                            { label: 'Idea' },
                            { label: 'Build Up' },
                            { label: 'Climax' },
                            { label: 'Resolution' },
                          ].map((phase, idx) => (
                            <div key={phase.label} className={`timeline-phase-tab ${idx === 0 ? 'timeline-phase-tab-active' : ''}`}>
                              {phase.label}
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-0 md:grid-cols-4">
                          {ideaDraftMeta.timeline.slice(0, 4).map((item, index) => {
                            const sectionValidation = ideaDraftMeta.validation.sectionValidations[index];
                            const visualState = getSectionVisualState(sectionValidation.wordCount, sectionValidation.minimumWords);
                            const cardTone = sectionValidation.isValid
                              ? 'border-emerald-500/20'
                              : visualState.tone === 'warning'
                                ? 'border-amber-500/20'
                                : 'border-rose-500/20';
                            const Icon = index === 0 ? Lightbulb : index === 1 ? FileText : index === 2 ? Flag : CircleCheckBig;
                            const accent = index === 0 ? 'text-amber-300' : index === 1 ? 'text-sky-200' : index === 2 ? 'text-rose-300' : 'text-emerald-300';
                            const subtitle = index === 0 ? 'Initial Concept' : index === 1 ? 'Develop Story' : index === 2 ? 'Key Moment' : 'Wrap Up';

                            return (
                              <div key={`${item.label}-${index}`} className={`timeline-stage-card border-r border-white/10 ${cardTone}`}>
                                <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent px-5 py-6 text-center min-h-[160px]">
                                  <Icon className={`h-10 w-10 ${accent}`} />
                                  <p className="mt-4 text-2xl font-semibold text-white">{subtitle}</p>
                                  <div className="mt-4 h-px w-full bg-white/10" />
                                  <p className="mt-3 text-2xl font-medium text-amber-200">{formatTimelineWindow(item.minutes, index, ideaDraftMeta.sections.targetMinutes)}</p>
                                  <p className="mt-3 text-xs leading-5 text-slate-300">{item.summary}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="border-t border-white/10 px-4 py-4 bg-[#202833]/70">
                          <div className="timeline-ruler flex items-center gap-3 rounded-xl border border-white/10 bg-[#313948] px-3 py-2">
                            <div className="rounded-md bg-slate-800 px-3 py-2 text-2xl font-semibold text-white">0:00</div>
                            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-700/70">
                              <div className="absolute inset-y-0 left-[4%] w-2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
                              <div className="absolute inset-y-0 left-[1%] w-[9%] bg-white/10" />
                              <div className="timeline-ruler-ticks absolute inset-0" />
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
              </motion.div>
            )}

            {results ? (
              <div className="space-y-6">
                {/* JSON Download Button */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={downloadResults}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download JSON
                  </button>
                  <button
                    onClick={downloadTranscript}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Transcript
                  </button>
                </div>

                {/* Transcript */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-emerald-500" />
                      Transcript
                    </h3>
                    <button
                      onClick={() => copyToClipboard(results.Transcript, 'transcript')}
                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                        copied === 'transcript'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      {copied === 'transcript' ? (
                        <>
                          <Check className="w-4 h-4 inline mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 inline mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {results.Transcript}
                    </p>
                  </div>
                </motion.div>

                {/* Chapters */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-500" />
                      Chapters
                    </h3>
                    <button
                      onClick={() => copyToClipboard(results.Chapters.join('\n'), 'chapters')}
                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                        copied === 'chapters'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      {copied === 'chapters' ? (
                        <>
                          <Check className="w-4 h-4 inline mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 inline mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {results.Chapters.map((chapter, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/80 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-xs font-bold text-emerald-400">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-slate-300 flex-1">
                          {chapter}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                      Summary
                    </h3>
                    <button
                      onClick={() => copyToClipboard(results.Summary, 'summary')}
                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                        copied === 'summary'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      {copied === 'summary' ? (
                        <>
                          <Check className="w-4 h-4 inline mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 inline mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4">
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
                    className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Target className="w-5 h-5 text-amber-400" />
                        Highlight Finder
                      </h3>
                      <button
                        onClick={() => copyToClipboard(derivedResults.highlights.map((highlight) => `${highlight.timestamp} ${highlight.title}`).join('\n'), 'highlights')}
                        className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                          copied === 'highlights'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'hover:bg-white/10 text-slate-400'
                        }`}
                      >
                        {copied === 'highlights' ? (
                          <>
                            <Check className="w-4 h-4 inline mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 inline mr-1" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {derivedResults.highlights.map((highlight, idx) => (
                        <div key={`${highlight.timestamp}-${idx}`} className="rounded-xl bg-slate-900/50 p-4 border border-white/5">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-sm font-mono text-amber-300">{highlight.timestamp}</span>
                            <span className="text-xs font-semibold text-amber-400">{highlight.score}%</span>
                          </div>
                          <p className="text-sm text-slate-200">{highlight.title}</p>
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
                    className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Hash className="w-5 h-5 text-green-400" />
                        SEO
                      </h3>
                      <button
                        onClick={() => copyToClipboard(`${derivedResults.seo.title}\n\n${derivedResults.seo.description}\n\n${derivedResults.seo.keywords.join(', ')}`, 'seo')}
                        className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                          copied === 'seo'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'hover:bg-white/10 text-slate-400'
                        }`}
                      >
                        {copied === 'seo' ? (
                          <>
                            <Check className="w-4 h-4 inline mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 inline mr-1" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-xl bg-slate-900/50 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 mb-2">Title</p>
                        <p className="text-sm text-slate-200">{derivedResults.seo.title}</p>
                      </div>
                      <div className="rounded-xl bg-slate-900/50 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 mb-2">Description</p>
                        <p className="text-sm text-slate-200">{derivedResults.seo.description}</p>
                      </div>
                      <div className="rounded-xl bg-slate-900/50 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 mb-3">Keywords</p>
                        <div className="flex flex-wrap gap-2">
                          {derivedResults.seo.keywords.map((keyword) => (
                            <span key={keyword} className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-300">
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
                    className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-violet-400" />
                        Social Captions
                      </h3>
                      <button
                        onClick={() => copyToClipboard(derivedResults.socialCaptions.join('\n\n'), 'captions')}
                        className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                          copied === 'captions'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'hover:bg-white/10 text-slate-400'
                        }`}
                      >
                        {copied === 'captions' ? (
                          <>
                            <Check className="w-4 h-4 inline mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 inline mr-1" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {derivedResults.socialCaptions.map((caption, idx) => (
                        <div key={idx} className="rounded-xl bg-slate-900/50 p-4">
                          <p className="text-sm whitespace-pre-wrap text-slate-200">{caption}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-12 border border-white/10 border-dashed flex items-center justify-center min-h-96"
              >
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-200 mb-2">
                    No results yet
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {activeTab === 'youtube'
                      ? 'Enter a YouTube URL and click "Process YouTube" to get started'
                      : 'Paste your script text and click "Process Script" to get started'}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 mb-12"
        >
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/50 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <h4 className="font-semibold text-white mb-1">Smart Transcripts</h4>
            <p className="text-xs text-slate-400">
              Accurate transcripts with timestamps for both YouTube videos and scripts
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/50 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h4 className="font-semibold text-white mb-1">Auto Chapters</h4>
            <p className="text-xs text-slate-400">
              Automatically generate chapter timestamps and titles for better organization
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="font-semibold text-white mb-1">AI Summaries</h4>
            <p className="text-xs text-slate-400">
              Get concise, comprehensive summaries of your content in seconds
            </p>
          </div>
        </motion.div>
      </div>

      {isIdeaModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Idea Draft</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Turn a short idea into a script draft</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Enter 1 to 2 sentences. The backend expands it into a structured draft and places it in the Script section for editing.
                </p>
              </div>
              <button
                onClick={() => setIsIdeaModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close idea modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Core Idea</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Write the original idea you want transformed</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    This is the source concept the app uses to build the storyboard, structure, and final script draft.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-400/20 bg-black/20 p-3">
                  <Lightbulb className="h-6 w-6 text-amber-300" />
                </div>
              </div>

              <label className="mt-4 block text-sm font-semibold text-slate-200">Your idea</label>
              <textarea
                value={ideaInput}
                onChange={(e) => setIdeaInput(e.target.value)}
                placeholder="Example: I want a short video explaining how creators can turn long YouTube videos into clips, captions, and SEO assets faster."
                className="mt-2 h-36 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-amber-400 resize-none"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Keep it to 1 or 2 sentences with a clear topic and outcome.</span>
                <span>{ideaInput.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>

                <button
                  onClick={handleGenerateIdeaDraft}
                  disabled={ideaLoading}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:bg-slate-600 disabled:text-slate-200"
                >
                  {ideaLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    Generating storyboard...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4" />
                    Generate storyboard
                    </>
                  )}
                </button>

              {ideaDraftMeta && hasGeneratedStoryboardContent(ideaDraftMeta.sections) && (
                <p className="mt-3 text-xs text-amber-200">
                  Storyboard content has been generated below for Initial Concept, Develop Story, Key Moment, and Wrap Up.
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-200">Script presets</p>
                  <span className="text-xs text-slate-400">Optional convenience only</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {SCRIPT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyScriptPreset(preset.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        selectedPresetId === preset.id
                          ? 'border-emerald-500/40 bg-emerald-500/15'
                          : 'border-white/10 bg-slate-900 hover:border-white/20'
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{preset.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#171d27] p-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 bg-gradient-to-r from-slate-800/80 to-slate-800/40">
                  <div>
                    <p className="text-sm font-semibold text-white">Idea storyboard structure</p>
                    <p className="text-xs text-slate-400">Build the idea in the same phase flow as the script timeline, with larger writing areas for each section.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    Length
                    <select
                      value={ideaSections.targetMinutes}
                      onChange={(e) => setIdeaSections((current) => ({ ...current, targetMinutes: Number(e.target.value) }))}
                      className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-400"
                    >
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                    </select>
                  </label>
                </div>

                <div className="timeline-phase-row grid grid-cols-4 border-b border-white/10 bg-gradient-to-r from-slate-700/40 via-slate-700/20 to-slate-700/40">
                  {[
                    { label: 'Idea' },
                    { label: 'Build Up' },
                    { label: 'Climax' },
                    { label: 'Resolution' },
                  ].map((phase, idx) => (
                    <div key={phase.label} className={`timeline-phase-tab ${idx === 0 ? 'timeline-phase-tab-active' : ''}`}>
                      {phase.label}
                    </div>
                  ))}
                </div>

                <div className="grid gap-0 lg:grid-cols-2 2xl:grid-cols-4">
                  {[
                    {
                      key: 'introduction' as const,
                      title: 'Initial Concept',
                      icon: Lightbulb,
                      accent: 'text-amber-300',
                      hint: 'Hook, context, and promise',
                    },
                    {
                      key: 'development' as const,
                      title: 'Develop Story',
                      icon: FileText,
                      accent: 'text-sky-200',
                      hint: 'Main beats, examples, or dialogue',
                    },
                    {
                      key: 'climax' as const,
                      title: 'Key Moment',
                      icon: Flag,
                      accent: 'text-rose-300',
                      hint: 'Peak moment or reveal',
                    },
                    {
                      key: 'resolution' as const,
                      title: 'Wrap Up',
                      icon: CircleCheckBig,
                      accent: 'text-emerald-300',
                      hint: 'Takeaway and CTA',
                    },
                  ].map((section, index) => {
                    const Icon = section.icon;
                    const state = liveSectionStates[section.key];
                    const wordCount = countSectionWords(ideaSections[section.key]);
                    return (
                      <div key={section.key} className={`border-b border-r border-white/10 p-4 ${state.background}`}>
                        <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                              <Icon className={`h-8 w-8 ${section.accent}`} />
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Phase</p>
                              <p className="text-sm font-semibold text-white">{section.title}</p>
                            </div>
                          </div>
                          <div className="mt-3 h-px w-full bg-white/10" />
                          <p className="mt-3 text-lg font-medium text-amber-200">
                            {formatTimelineWindow(
                              index === 0 ? Math.max(1, Math.round(ideaSections.targetMinutes * 0.13)) : index === 1 ? Math.max(2, Math.round(ideaSections.targetMinutes * 0.27)) : index === 2 ? Math.max(2, Math.round(ideaSections.targetMinutes * 0.27)) : Math.max(1, Math.round(ideaSections.targetMinutes * 0.2)),
                              index,
                              ideaSections.targetMinutes,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">{section.hint}</p>
                          <textarea
                            value={ideaSections[section.key]}
                            onChange={(e) => updateIdeaSection(section.key, e.target.value)}
                            placeholder={section.hint}
                            className={`mt-4 min-h-[220px] w-full rounded-2xl border bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-amber-400 resize-none ${state.border}`}
                          />
                          <div className="mt-3 flex items-center justify-between text-[11px]">
                            <span className={state.chip}>{wordCount}/{IDEA_SECTION_MINIMUMS[section.key]} words</span>
                            <span className="text-slate-500">{section.hint}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-white/10 px-4 py-4 bg-[#202833]/70">
                  <div className="timeline-ruler flex items-center gap-3 rounded-xl border border-white/10 bg-[#313948] px-3 py-2">
                    <div className="rounded-md bg-slate-800 px-3 py-2 text-2xl font-semibold text-white">0:00</div>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-700/70">
                      <div className="absolute inset-y-0 left-[4%] w-2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
                      <div className="absolute inset-y-0 left-[1%] w-[9%] bg-white/10" />
                      <div className="timeline-ruler-ticks absolute inset-0" />
                      <div className="absolute inset-y-0 right-0 w-[2%] bg-white/15" />
                    </div>
                    <div className="rounded-md bg-slate-800 px-3 py-2 text-2xl font-semibold text-white">{formatClockLabel(ideaSections.targetMinutes)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                onClick={() => setIsIdeaModalOpen(false)}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </button>
            </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StudioPage;
