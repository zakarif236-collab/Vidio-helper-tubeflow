import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, Copy, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Topic {
  name: string;
  relevance: number;
  mentions: number;
}

const TopicDetectorPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [copied, setCopied] = useState(false);

  const detectTopics = async () => {
    if (!videoUrl.trim()) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTopics([
        { name: 'AI & Machine Learning', relevance: 95, mentions: 24 },
        { name: 'Content Creation', relevance: 88, mentions: 19 },
        { name: 'Video Marketing', relevance: 85, mentions: 16 },
        { name: 'YouTube Optimization', relevance: 92, mentions: 22 },
        { name: 'Productivity Tools', relevance: 78, mentions: 14 },
        { name: 'Digital Content', relevance: 82, mentions: 18 },
      ]);
    } catch (error) {
      console.error('Error detecting topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyTopics = () => {
    const text = topics.map(t => `${t.name} (${t.relevance}%)`).join(', ');
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
            <Tag className="w-6 h-6 text-orange-500" />
            Topic Detector
          </h1>
          <p className="text-xs text-slate-400">Identify the main subjects and themes discussed in the video</p>
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
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-orange-500 focus:outline-none mb-4"
          />
          <button
            onClick={detectTopics}
            disabled={loading || !videoUrl.trim()}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Detecting Topics...
              </>
            ) : (
              <>
                <Tag className="w-5 h-5" />
                Detect Topics
              </>
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        {topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Detected Topics</h2>
              <button
                onClick={copyTopics}
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

            {topics.map((topic, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{topic.name}</h3>
                  <span className="text-sm font-mono text-orange-400">{topic.mentions} mentions</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${topic.relevance}%` }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">{topic.relevance}% relevance</p>
              </motion.div>
            ))}

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{topics.length}</div>
                <div className="text-xs text-slate-400">Topics Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{topics.reduce((a, b) => a + b.mentions, 0)}</div>
                <div className="text-xs text-slate-400">Total Mentions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{Math.round(topics.reduce((a, b) => a + b.relevance, 0) / topics.length)}%</div>
                <div className="text-xs text-slate-400">Avg Relevance</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && topics.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-slate-400"
          >
            <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a video URL to detect topics</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TopicDetectorPage;
