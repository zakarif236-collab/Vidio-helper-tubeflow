import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Copy, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface Highlight {
  timestamp: string;
  duration: string;
  engagementScore: number;
  title: string;
}

const HighlightFinderPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [copied, setCopied] = useState(false);

  const findHighlights = async () => {
    if (!videoUrl.trim()) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setHighlights([
        { timestamp: '0:45', duration: '15s', engagementScore: 98, title: 'Shocking revelation' },
        { timestamp: '3:20', duration: '20s', engagementScore: 92, title: 'Major plot twist' },
        { timestamp: '5:50', duration: '18s', engagementScore: 89, title: 'Unexpected outcome' },
        { timestamp: '8:15', duration: '12s', engagementScore: 85, title: 'Funny moment' },
        { timestamp: '10:30', duration: '25s', engagementScore: 94, title: 'Climactic scene' },
      ]);
    } catch (error) {
      console.error('Error finding highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyHighlights = () => {
    const text = highlights.map(h => `${h.timestamp} - ${h.title} (${h.duration})`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <Zap className="w-6 h-6 text-yellow-500" />
            Highlight Finder
          </h1>
          <p className="text-xs text-slate-400">Automatically find the most engaging moments for shorts or reels</p>
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
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-yellow-500 focus:outline-none mb-4"
          />
          <button
            onClick={findHighlights}
            disabled={loading || !videoUrl.trim()}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Finding Highlights...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Find Highlights
              </>
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        {highlights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Top Highlights</h2>
              <button
                onClick={copyHighlights}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
              >
                {copied ? (
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

            {highlights.map((highlight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{highlight.title}</h3>
                    <div className="flex gap-4 mt-2 text-sm text-slate-400">
                      <span>⏱️ {highlight.timestamp}</span>
                      <span>⏲️ {highlight.duration}</span>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${highlight.engagementScore}%` }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-yellow-400 whitespace-nowrap">{highlight.engagementScore}%</span>
                </div>
              </motion.div>
            ))}

            {/* Export Options */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-700">
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Create Reels
              </button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Export Clips</button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Share</button>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && highlights.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-slate-400"
          >
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a video URL to find highlights</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default HighlightFinderPage;
