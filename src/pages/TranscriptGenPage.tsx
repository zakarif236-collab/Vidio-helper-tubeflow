import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Copy, Check, Loader2, Download } from 'lucide-react';
import { motion } from 'framer-motion';

const TranscriptGenPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [copied, setCopied] = useState(false);

  const generateTranscript = async () => {
    if (!videoUrl.trim()) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTranscript(
        `[0:00] Hello everyone, welcome to our comprehensive guide on AI video tools.\n` +
        `[0:05] Today, we're going to explore how artificial intelligence is revolutionizing content creation.\n` +
        `[0:12] Whether you're a beginner or an experienced creator, these tools will help you work smarter, not harder.\n` +
        `[0:20] Let's start with the basics. AI video tools can automate many time-consuming tasks.\n` +
        `[0:28] From generating chapters and summaries to creating stunning thumbnails, the possibilities are endless.\n` +
        `[0:35] First up, we have Auto Chapters. This tool can automatically generate timestamps for your YouTube videos.\n` +
        `[0:42] Imagine never having to manually create chapter markers again.\n` +
        `[0:48] Next, let's talk about AI Summary. This tool provides concise summaries of your video content.\n` +
        `[0:55] It's perfect for creating compelling descriptions or marketing materials.\n` +
        `[1:02] And that's just scratching the surface of what these tools can do.`
      );
    } catch (error) {
      console.error('Error generating transcript:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyTranscript = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTranscript = () => {
    const element = document.createElement('a');
    const file = new Blob([transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'transcript.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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
            <MessageSquare className="w-6 h-6 text-rose-500" />
            Transcript Gen
          </h1>
          <p className="text-xs text-slate-400">Convert video speech to accurate text transcripts</p>
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
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-rose-500 focus:outline-none mb-4"
          />
          <button
            onClick={generateTranscript}
            disabled={loading || !videoUrl.trim()}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Transcript...
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5" />
                Generate Transcript
              </>
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Video Transcript</h2>
              <div className="flex gap-2">
                <button
                  onClick={copyTranscript}
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
                <button
                  onClick={downloadTranscript}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed font-mono text-sm">{transcript}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-rose-500">{transcript.split('\n').length}</div>
                <div className="text-xs text-slate-400">Lines</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-rose-500">{transcript.split(' ').length}</div>
                <div className="text-xs text-slate-400">Words</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-rose-500">{transcript.length}</div>
                <div className="text-xs text-slate-400">Characters</div>
              </div>
            </div>

            {/* Export Options */}
            <div className="grid grid-cols-3 gap-3 mt-6 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Export as PDF</button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Export as SRT</button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Edit</button>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !transcript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-slate-400"
          >
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a video URL to generate transcript</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TranscriptGenPage;
