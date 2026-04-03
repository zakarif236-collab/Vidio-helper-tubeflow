import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface SEOData {
  titles: string[];
  descriptions: string[];
  keywords: string[];
  tags: string[];
}

const SEOGeneratorPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [seoData, setSeoData] = useState<SEOData | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generateSEO = async () => {
    if (!videoUrl.trim()) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSeoData({
        titles: [
          '🚀 Revolutionary AI Video Tools - Complete Guide [2024]',
          'AI Video Optimization Tools for Content Creators - Ultimate Review',
          'How to Use AI for YouTube: Smart Thumbnails, SEO & More',
        ],
        descriptions: [
          'Discover the best AI video optimization tools for YouTube creators. Learn how to generate chapters, summaries, transcripts, and more automatically. Boost your video SEO and engagement today!',
          'Complete guide to AI-powered video tools. Generate smart timestamps, AI summaries, SEO optimization, and create stunning thumbnails. Perfect for content creators and YouTubers.',
        ],
        keywords: [
          'AI video tools', 'YouTube optimization', 'video SEO', 'content creation',
          'AI thumbnail generator', 'video transcript', 'YouTube chapters', 'short form content',
        ],
        tags: [
          'AI', 'YouTube Creator', 'Video Marketing', 'Content Creation',
          'Productivity', 'Video Editing', 'SEO Tips', 'Creator Tools',
        ],
      });
    } catch (error) {
      console.error('Error generating SEO:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyItem = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
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
            <Sparkles className="w-6 h-6 text-green-500" />
            SEO Generator
          </h1>
          <p className="text-xs text-slate-400">Generate optimized titles, descriptions, and keywords</p>
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
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-green-500 focus:outline-none mb-4"
          />
          
          <label className="block text-sm font-semibold mb-3">Video Title (Optional)</label>
          <input
            type="text"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Enter your video title..."
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-green-500 focus:outline-none mb-4"
          />
          
          <button
            onClick={generateSEO}
            disabled={loading || !videoUrl.trim()}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating SEO Data...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate SEO Data
              </>
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        {seoData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Titles */}
            <div>
              <h2 className="text-xl font-bold mb-4">📝 Suggested Titles</h2>
              <div className="space-y-3">
                {seoData.titles.map((title, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 group hover:border-slate-600 transition-colors flex items-start justify-between"
                  >
                    <p className="flex-1 text-slate-200">{title}</p>
                    <button
                      onClick={() => copyItem(title, `title-${idx}`)}
                      className="ml-4 p-2 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {copied === `title-${idx}` ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Descriptions */}
            <div>
              <h2 className="text-xl font-bold mb-4">📄 Suggested Descriptions</h2>
              <div className="space-y-3">
                {seoData.descriptions.map((desc, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 + 0.15 }}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 group hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <p className="flex-1 text-slate-200 text-sm">{desc}</p>
                      <button
                        onClick={() => copyItem(desc, `desc-${idx}`)}
                        className="ml-4 p-2 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      >
                        {copied === `desc-${idx}` ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <h2 className="text-xl font-bold mb-4">🔑 Keywords</h2>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 group">
                <div className="flex flex-wrap gap-2 mb-4">
                  {seoData.keywords.map((keyword, idx) => (
                    <motion.span
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.02 + 0.3 }}
                      className="px-3 py-1 bg-green-500/20 border border-green-500/50 text-green-400 text-sm rounded-full"
                    >
                      {keyword}
                    </motion.span>
                  ))}
                </div>
                <button
                  onClick={() => copyItem(seoData.keywords.join(', '), 'keywords')}
                  className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {copied === 'keywords' ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy All Keywords
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tags */}
            <div>
              <h2 className="text-xl font-bold mb-4">🏷️ Tags</h2>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {seoData.tags.map((tag, idx) => (
                    <motion.span
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.02 + 0.4 }}
                      className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-400 text-sm rounded-full"
                    >
                      {tag}
                    </motion.span>
                  ))}
                </div>
                <button
                  onClick={() => copyItem(seoData.tags.join(', '), 'tags')}
                  className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {copied === 'tags' ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy All Tags
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !seoData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-slate-400"
          >
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a video URL to generate SEO data</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SEOGeneratorPage;
