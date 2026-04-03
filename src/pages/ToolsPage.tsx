import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Sparkles, Tag, Zap, Image as ImageIcon, FileText, MessageSquare, Settings2, Plus, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';

const ToolsPage = () => {
  const navigate = useNavigate();

  const tools = [
    {
      id: 'idea-to-video',
      name: 'Idea → Full Video Package',
      description: 'Transform any idea into a complete, production-ready video with script, transcript, chapters, SEO, and socials.',
      icon: Lightbulb,
      color: 'from-emerald-500 to-teal-500',
      path: '/idea-to-video',
      featured: true,
    },
    {
      id: 'auto-chapters',
      name: 'Auto Chapters',
      description: 'Generate smart timestamps for your YouTube videos automatically.',
      icon: Clock,
      color: 'from-blue-500 to-cyan-500',
      path: '/tools/auto-chapters',
    },
    {
      id: 'ai-summary',
      name: 'AI Summary',
      description: 'Get a concise summary of any video content in seconds.',
      icon: FileText,
      color: 'from-purple-500 to-pink-500',
      path: '/tools/ai-summary',
    },
    {
      id: 'topic-detector',
      name: 'Topic Detector',
      description: 'Identify the main subjects and themes discussed in the video.',
      icon: Tag,
      color: 'from-orange-500 to-red-500',
      path: '/tools/topic-detector',
    },
    {
      id: 'highlight-finder',
      name: 'Highlight Finder',
      description: 'Automatically find the most engaging moments for shorts or reels.',
      icon: Zap,
      color: 'from-yellow-500 to-orange-500',
      path: '/tools/highlight-finder',
    },
    {
      id: 'seo-generator',
      name: 'SEO Generator',
      description: 'Generate optimized titles, descriptions, and keywords.',
      icon: Sparkles,
      color: 'from-green-500 to-emerald-500',
      path: '/tools/seo-generator',
    },
    {
      id: 'thumbnail-ai',
      name: 'Thumbnail AI',
      description: 'Create eye-catching thumbnails using generative AI and advanced design.',
      icon: ImageIcon,
      color: 'from-indigo-500 to-purple-500',
      path: '/creator-lab',
    },
    {
      id: 'transcript-gen',
      name: 'Transcript Gen',
      description: 'Convert video speech to accurate text transcripts.',
      icon: MessageSquare,
      color: 'from-rose-500 to-pink-500',
      path: '/tools/transcript-gen',
    },
    {
      id: 'social-captions',
      name: 'Social Captions',
      description: 'Create engaging captions for Twitter, Instagram, and more.',
      icon: MessageSquare,
      color: 'from-violet-500 to-purple-500',
      path: '/tools/social-captions',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-emerald-500" />
              AI Video Helper Tools
            </h1>
            <p className="text-sm text-slate-400 mt-1">Everything you need to optimize your video content in one place</p>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-7xl mx-auto p-8">
        {/* Featured Tool */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate(tools[0].path)}
          className="group cursor-pointer mb-8"
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/50 rounded-2xl p-8 hover:border-emerald-400 transition-all hover:shadow-lg hover:shadow-emerald-500/20">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-full mb-4">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">⭐ Featured</span>
                </div>
                <h2 className="text-3xl font-bold mb-2">{tools[0].name}</h2>
                <p className="text-slate-300 mb-4 text-lg">{tools[0].description}</p>
                <div className="flex items-center gap-2 text-emerald-400 group-hover:gap-3 transition-all">
                  <span className="font-semibold">Get Started</span>
                  <Plus className="w-5 h-5" />
                </div>
              </div>
              <div className={`flex-shrink-0 p-4 bg-gradient-to-br ${tools[0].color} rounded-xl`}>
                <Lightbulb className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>
        </motion.div>

        <h2 className="text-2xl font-bold mb-6 mt-12">All Tools</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.slice(1).map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => navigate(tool.path)}
                className="group cursor-pointer"
              >
                <div className="h-full bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all hover:shadow-xl hover:shadow-slate-900/50">
                  {/* Icon Section */}
                  <div className={`mb-4 p-3 bg-gradient-to-br ${tool.color} rounded-lg w-fit`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold mb-2">{tool.name}</h3>

                  {/* Description */}
                  <p className="text-slate-400 text-sm mb-4">{tool.description}</p>

                  {/* CTA */}
                  <div className="flex items-center gap-2 text-emerald-400 group-hover:gap-3 transition-all">
                    <span className="text-sm font-semibold">Open Tool</span>
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-8 pb-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-8"
        >
          <h2 className="text-xl font-bold mb-4">Why Use Video Helper Tools?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🚀 Faster Production</h3>
              <p className="text-slate-400">Automate repetitive tasks and focus on creating amazing content</p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">📊 Better Performance</h3>
              <p className="text-slate-400">Optimize titles, descriptions, and tags for maximum reach</p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🎨 Professional Quality</h3>
              <p className="text-slate-400">Generate high-quality thumbnails and captions instantly</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ToolsPage;
