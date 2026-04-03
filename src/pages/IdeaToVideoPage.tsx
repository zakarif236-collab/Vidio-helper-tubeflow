import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Settings2,
  Loader2,
  Copy,
  Check,
  Download,
  Edit2,
  Save,
  X,
  Lightbulb,
  Play,
  FileText,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  Instagram,
  Twitter,
  Music,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateScriptFromIdea, generateFullVideoPackage, FullVideoPackage } from '../services/geminiService';

type ToneType = 'casual' | 'professional' | 'motivational';
type Step = 'idea' | 'script' | 'package';

const IdeaToVideoPage = () => {
  const navigate = useNavigate();
  
  // State management
  const [step, setStep] = useState<Step>('idea');
  const [subject, setSubject] = useState('');
  const [tone, setTone] = useState<ToneType>('casual');
  const [loading, setLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [editingScript, setEditingScript] = useState('');
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [fullPackage, setFullPackage] = useState<FullVideoPackage | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'seo' | 'thumbnails' | 'socials'>('summary');

  const toneOptions: { value: ToneType; label: string; description: string }[] = [
    { value: 'casual', label: 'Casual', description: 'Friendly & conversational' },
    { value: 'professional', label: 'Professional', description: 'Structured & authoritative' },
    { value: 'motivational', label: 'Motivational', description: 'Inspiring & energetic' },
  ];

  const handleGenerateScript = async () => {
    if (!subject.trim()) {
      setError('Please enter a subject or idea');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const script = await generateScriptFromIdea(subject, tone);
      setGeneratedScript(script);
      setEditingScript(script);
      setStep('script');
    } catch (err) {
      console.error('Error generating script:', err);
      setError('Failed to generate script. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePackage = async () => {
    setLoading(true);
    setError('');
    try {
      const pkg = await generateFullVideoPackage(editingScript);
      setFullPackage(pkg);
      setStep('package');
    } catch (err) {
      console.error('Error generating package:', err);
      setError('Failed to generate complete package. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadPackage = () => {
    if (!fullPackage) return;
    const jsonString = JSON.stringify(fullPackage, null, 2);
    const element = document.createElement('a');
    const file = new Blob([jsonString], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = 'video-package.json';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100 p-6">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Play className="w-5 h-5 text-black fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Video<span className="text-emerald-500">Helper</span> - Idea Studio
          </span>
        </div>
        <div className="flex items-center gap-2">
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
            <Lightbulb className="w-10 h-10 text-emerald-500" />
            Idea → Full Video Package
          </h1>
          <p className="text-slate-400">
            Transform a simple idea into a complete, production-ready video package
          </p>
        </motion.div>

        {/* Step Indicator */}
        <div className="flex gap-4 mb-8">
          {(['idea', 'script', 'package'] as const).map((s, idx) => (
            <div key={s} className="flex items-center">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step === s
                    ? 'bg-emerald-500 text-black'
                    : step > s
                    ? 'bg-emerald-500/30 text-emerald-400'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {idx + 1}
              </motion.div>
              <span className="ml-2 text-sm font-semibold text-slate-300 capitalize">{s}</span>
              {idx < 2 && <div className="w-8 h-0.5 bg-slate-700 ml-4" />}
            </div>
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300"
          >
            {error}
          </motion.div>
        )}

        {/* Step 1: Idea Input */}
        <AnimatePresence mode="wait">
          {step === 'idea' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
            >
              <div className="lg:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Lightbulb className="w-6 h-6 text-emerald-500" />
                  Your Video Idea
                </h2>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    What's your video about?
                  </label>
                  <textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., How to stay productive at home, Top 5 productivity tips, Work from home setup guide..."
                    className="w-full h-32 px-4 py-3 bg-slate-700 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Tone & Style
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {toneOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTone(option.value)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          tone === option.value
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-slate-700 border-white/10 text-slate-300 hover:border-emerald-500/50'
                        }`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-slate-400 mt-1">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGenerateScript}
                  disabled={loading}
                  className="w-full mt-8 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Script
                    </>
                  )}
                </button>
              </div>

              {/* Benefits Card */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border border-emerald-500/30 rounded-2xl p-6"
              >
                <h3 className="font-bold text-lg mb-4 text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  You'll Get
                </h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs text-emerald-400">✓</div>
                    Complete video script
                  </li>
                  <li className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs text-emerald-400">✓</div>
                    Formatted transcript
                  </li>
                  <li className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs text-emerald-400">✓</div>
                    Auto chapters
                  </li>
                  <li className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs text-emerald-400">✓</div>
                    AI summary
                  </li>
                  <li className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs text-emerald-400">✓</div>
                    SEO titles & keywords
                  </li>
                  <li className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs text-emerald-400">✓</div>
                    Thumbnail concepts
                  </li>
                  <li className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs text-emerald-400">✓</div>
                    Social captions
                  </li>
                </ul>
              </motion.div>
            </motion.div>
          )}

          {/* Step 2: Script Editing */}
          {step === 'script' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="w-6 h-6 text-emerald-500" />
                  Review & Edit Script
                </h2>
                <button
                  onClick={() => setIsEditingScript(!isEditingScript)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    isEditingScript
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {isEditingScript ? (
                    <>
                      <Save className="w-4 h-4" />
                      Done Editing
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Edit Script
                    </>
                  )}
                </button>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Review the AI-generated script. You can edit it before generating your complete video package.
              </p>

              {isEditingScript ? (
                <textarea
                  value={editingScript}
                  onChange={(e) => setEditingScript(e.target.value)}
                  className="w-full h-96 px-4 py-3 bg-slate-700 border border-white/10 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors resize-none font-mono"
                />
              ) : (
                <div className="bg-slate-900/50 rounded-lg p-6 h-96 overflow-y-auto">
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {editingScript}
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('idea')}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleGeneratePackage}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Package...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Full Package
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Full Package Display */}
          {step === 'package' && fullPackage && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Tab Navigation */}
              <div className="flex gap-2 mb-6 border-b border-white/10 rounded-t-xl overflow-hidden bg-black/30">
                {(['summary', 'seo', 'thumbnails', 'socials'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-6 py-4 font-semibold transition-all capitalize ${
                      activeTab === tab
                        ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-500'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab === 'socials' ? 'Social Media' : tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-6 mb-8">
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    {/* Transcript */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-blue-400" />
                          Transcript
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.transcript, 'transcript')}
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
                          {fullPackage.transcript}
                        </p>
                      </div>
                    </div>

                    {/* Chapters */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <FileText className="w-5 h-5 text-purple-400" />
                          Chapters
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.chapters.join('\n'), 'chapters')}
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
                        {fullPackage.chapters.map((chapter, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/80 transition-colors"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-xs font-bold text-purple-400">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-slate-300">{chapter}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-emerald-400" />
                          Video Summary
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.summary, 'summary')}
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
                          {fullPackage.summary}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* SEO Tab */}
                {activeTab === 'seo' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    {/* Titles */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-lg font-bold mb-4">Video Titles</h3>
                      <div className="space-y-3">
                        {fullPackage.seoTitles.map((title, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg group"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-xs font-bold text-emerald-400">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-slate-300 flex-1">{title}</p>
                            <button
                              onClick={() => copyToClipboard(title, `title-${idx}`)}
                              className={`px-2 py-1 rounded text-xs font-semibold transition-colors opacity-0 group-hover:opacity-100 ${
                                copied === `title-${idx}`
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'hover:bg-white/10 text-slate-400'
                              }`}
                            >
                              {copied === `title-${idx}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Video Description</h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.seoDescription, 'description')}
                          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                            copied === 'description'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {copied === 'description' ? (
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
                        <p className="text-sm text-slate-300">
                          {fullPackage.seoDescription}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {fullPackage.seoDescription.length} characters
                        </p>
                      </div>
                    </div>

                    {/* Keywords */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Hash className="w-5 h-5 text-cyan-400" />
                          Keywords
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.keywords.join(', '), 'keywords')}
                          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                            copied === 'keywords'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {copied === 'keywords' ? (
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
                      <div className="flex flex-wrap gap-2">
                        {fullPackage.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-full text-sm text-cyan-400"
                          >
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Thumbnails Tab */}
                {activeTab === 'thumbnails' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-orange-400" />
                        Thumbnail Concepts
                      </h3>
                      <p className="text-sm text-slate-400 mb-4">
                        Use these concepts with Creator Lab to design your thumbnails
                      </p>
                      <div className="space-y-3">
                        {fullPackage.thumbnailConcepts.map((concept, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg group hover:bg-slate-900/80 transition-colors"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-xs font-bold text-orange-400">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-slate-300 flex-1">{concept}</p>
                            <button
                              onClick={() => copyToClipboard(concept, `thumbnail-${idx}`)}
                              className={`px-2 py-1 rounded text-xs font-semibold transition-colors opacity-0 group-hover:opacity-100 ${
                                copied === `thumbnail-${idx}`
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'hover:bg-white/10 text-slate-400'
                              }`}
                            >
                              {copied === `thumbnail-${idx}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => navigate('/creator-lab')}
                        className="mt-4 w-full px-4 py-2 bg-orange-500/20 border border-orange-500/50 text-orange-400 hover:bg-orange-500/30 rounded-lg font-semibold transition-colors text-sm"
                      >
                        Go to Creator Lab
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Socials Tab */}
                {activeTab === 'socials' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {/* Instagram */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Instagram className="w-5 h-5 text-pink-400" />
                          Instagram Caption
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.socialCaptions.instagram, 'instagram')}
                          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                            copied === 'instagram'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {copied === 'instagram' ? (
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
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">
                          {fullPackage.socialCaptions.instagram}
                        </p>
                      </div>
                    </div>

                    {/* TikTok */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Music className="w-5 h-5 text-black" />
                          TikTok Caption
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.socialCaptions.tiktok, 'tiktok')}
                          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                            copied === 'tiktok'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {copied === 'tiktok' ? (
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
                        <p className="text-sm text-slate-300">
                          {fullPackage.socialCaptions.tiktok}
                        </p>
                      </div>
                    </div>

                    {/* Twitter */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Twitter className="w-5 h-5 text-sky-400" />
                          Twitter/X Caption
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.socialCaptions.twitter, 'twitter')}
                          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                            copied === 'twitter'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {copied === 'twitter' ? (
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
                        <p className="text-sm text-slate-300">
                          {fullPackage.socialCaptions.twitter}
                        </p>
                      </div>
                    </div>

                    {/* YouTube */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Play className="w-5 h-5 text-red-400" />
                          YouTube Community Post
                        </h3>
                        <button
                          onClick={() => copyToClipboard(fullPackage.socialCaptions.youtube, 'youtube')}
                          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                            copied === 'youtube'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {copied === 'youtube' ? (
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
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">
                          {fullPackage.socialCaptions.youtube}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 sticky bottom-6">
                <button
                  onClick={() => setStep('script')}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Script
                </button>
                <button
                  onClick={downloadPackage}
                  className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Complete Package
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default IdeaToVideoPage;
