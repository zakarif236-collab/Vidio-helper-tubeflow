import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Clock, Copy, Check, Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Chapter {
  timestamp: string;
  title: string;
  description: string;
}

const AutoChaptersPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const generateChapters = async () => {
    if (!videoUrl.trim()) return;
    
    setLoading(true);
    try {
      // Simulate API call - replace with real Gemini API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockChapters: Chapter[] = [
        { timestamp: '0:00', title: 'Introduction', description: 'Welcome and topic overview' },
        { timestamp: '1:23', title: 'Main Concept', description: 'Deep dive into the main idea' },
        { timestamp: '4:56', title: 'Examples', description: 'Real-world examples and use cases' },
        { timestamp: '8:30', title: 'Q&A', description: 'Answering common questions' },
        { timestamp: '11:00', title: 'Conclusion', description: 'Summary and call to action' },
      ];
      
      setChapters(mockChapters);
    } catch (error) {
      console.error('Error generating chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyChaptersText = (index: string) => {
    const text = chapters.map(ch => `${ch.timestamp} ${ch.title}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/tools')}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-500" />
            Auto Chapters
          </h1>
          <p className="text-xs text-slate-400">Generate smart timestamps for your YouTube videos automatically</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 mb-8"
        >
          <label className="block text-sm font-semibold mb-3">Video URL or ID</label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube URL or video ID..."
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none mb-4"
          />
          <button
            onClick={generateChapters}
            disabled={loading || !videoUrl.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Chapters...
              </>
            ) : (
              <>
                <Clock className="w-5 h-5" />
                Generate Chapters
              </>
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        {chapters.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Generated Chapters</h2>
              <button
                onClick={() => copyChaptersText('all')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
              >
                {copied === 'all' ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy All
                  </>
                )}
              </button>
            </div>

            {chapters.map((chapter, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-mono text-blue-400 mb-1">{chapter.timestamp}</div>
                    <h3 className="font-semibold text-lg">{chapter.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{chapter.description}</p>
                  </div>
                  <button
                    onClick={() => copyChaptersText(String(index))}
                    className="ml-4 p-2 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    {copied === String(index) ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}

            {/* YouTube Format */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mt-6">
              <h3 className="font-semibold mb-3">YouTube Description Format</h3>
              <div className="bg-slate-900 p-3 rounded text-xs font-mono text-slate-300 overflow-auto max-h-40">
                {chapters.map(ch => `${ch.timestamp} ${ch.title}`).join('\n')}
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && chapters.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-slate-400"
          >
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a video URL to generate chapters</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AutoChaptersPage;
