import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Copy, Check, Loader2, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface CaptionVariant {
  platform: string;
  icon: string;
  captions: string[];
}

const SocialCaptionsPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [captions, setCaptions] = useState<CaptionVariant[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const generateCaptions = async () => {
    if (!videoUrl.trim()) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCaptions([
        {
          platform: 'Twitter/X',
          icon: '𝕏',
          captions: [
            '🚀 Just dropped: The ultimate AI video tool guide! Discover how to automate your entire YouTube workflow with smart chapters, transcripts, and AI-generated thumbnails. #ContentCreation #AI',
            'Your next big break might be one short clip away. Find the most engaging moments in your videos automatically with our Highlight Finder. #VideoMarketing #Shorts',
            'Stop wasting hours on SEO. Generate optimized titles, descriptions, and tags in seconds. Your algorithm will thank you. #YouTubeTips #Creator',
          ],
        },
        {
          platform: 'Instagram',
          icon: '📷',
          captions: [
            '✨ Revolutionizing Content Creation ✨\n\nDiscover the power of AI tools that help creators work smarter. From auto-generated chapters to stunning thumbnails, we\'ve got you covered. 🎬\n\n💡 Save time, boost engagement, dominate the algorithm.\n\n#ContentCreator #YouTubeGrowth #AI #CreatorEconomy',
            'The secret sauce to viral content? Finding the RIGHT moments. 🎥⚡\n\nOur Highlight Finder does the heavy lifting, so you can focus on creating. #Reels #Shorts #ContentCreation',
          ],
        },
        {
          platform: 'TikTok',
          icon: '♪',
          captions: [
            '🤖 AI just changed the game for content creators 🎥 From auto chapters to instant thumbnails, we\'re living in the future #ContentCreator #AI #YouTubeTips',
            'Your next viral moment is hiding in your video... until now 👀✨ #CreatorLife #Shorts #Viral',
            'Stop spending 3 hours on SEO. Let AI handle it. 🚀 #CreatorTools #ProTips #Productivity',
          ],
        },
        {
          platform: 'LinkedIn',
          icon: '💼',
          captions: [
            'The Future of Content Production: How AI is Transforming the Creator Economy\n\nArtificial Intelligence is fundamentally changing how content creators work. By automating routine tasks like transcript generation, SEO optimization, and thumbnail creation, creators can focus on storytelling and strategy.\n\nKey benefits:\n• 40% faster production time\n• Higher engagement through AI-optimized content\n• Better searchability and discoverability\n• Professional quality outputs at scale',
            'Scaling Your Content Operations with AI: A Data-Driven Approach\n\nFor content teams and creators looking to increase output without proportionally increasing costs, AI video tools offer a compelling ROI. Here\'s what we\'re seeing in the market...',
          ],
        },
      ]);
    } catch (error) {
      console.error('Error generating captions:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCaption = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
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
            <MessageSquare className="w-6 h-6 text-violet-500" />
            Social Captions
          </h1>
          <p className="text-xs text-slate-400">Create engaging captions for Twitter, Instagram, TikTok, and more</p>
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
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none mb-4"
          />
          <button
            onClick={generateCaptions}
            disabled={loading || !videoUrl.trim()}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Captions...
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5" />
                Generate Captions
              </>
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        {captions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {captions.map((variant, platformIdx) => (
              <div key={platformIdx} className="space-y-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-2xl">{variant.icon}</span>
                  {variant.platform}
                </h2>

                {variant.captions.map((caption, captionIdx) => (
                  <motion.div
                    key={captionIdx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (platformIdx * 0.1) + (captionIdx * 0.05) }}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 group hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <p className="flex-1 text-slate-200 text-sm whitespace-pre-wrap">{caption}</p>
                      <button
                        onClick={() => copyCaption(caption, `${platformIdx}-${captionIdx}`)}
                        className="ml-4 p-2 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      >
                        {copied === `${platformIdx}-${captionIdx}` ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">{caption.length} characters</div>
                  </motion.div>
                ))}
              </div>
            ))}

            {/* Share Options */}
            <div className="grid grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-700">
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />
                Copy All
              </button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Export</button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Schedule</button>
              <button className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Share</button>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && captions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-slate-400"
          >
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a video URL to generate social captions</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SocialCaptionsPage;
