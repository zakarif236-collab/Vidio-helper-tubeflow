import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Copy, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const AISummaryPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    if (!videoUrl.trim()) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSummary(
        'This video provides a comprehensive overview of AI-powered content creation tools for video creators. The main topics covered include:\n\n' +
        '• Introduction to AI video optimization\n' +
        '• Automated chapter generation for YouTube\n' +
        '• AI-powered thumbnail creation and design\n' +
        '• SEO optimization for video titles and descriptions\n' +
        '• Transcript generation and editing\n' +
        '• Best practices for video marketing\n\n' +
        'Key takeaways: Using AI tools can significantly reduce production time while maintaining quality. The tools discussed are essential for modern content creators looking to scale their output.'
      );
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
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
            <FileText className="w-6 h-6 text-purple-500" />
            AI Summary
          </h1>
          <p className="text-xs text-slate-400">Get a concise summary of any video content in seconds</p>
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
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none mb-4"
          />
          <button
            onClick={generateSummary}
            disabled={loading || !videoUrl.trim()}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Summary
              </>
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Summary</h2>
              <button
                onClick={copySummary}
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
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{summary}</p>
            </div>

            {/* Export Options */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Export as PDF</button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Share</button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Save</button>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-slate-400"
          >
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a video URL to generate a summary</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AISummaryPage;
