import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Play } from 'lucide-react';

const HomePage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100 p-6">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Play className="w-5 h-5 text-black fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">Video<span className="text-emerald-500">Helper</span></span>
        </div>
        <Link
          to="/tools"
          className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm font-semibold"
        >
          <Sparkles className="w-4 h-4" />
          Tools
        </Link>
      </div>

      <div className="max-w-2xl text-center">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-4 flex items-center justify-center gap-3">
            <Sparkles className="w-12 h-12 text-emerald-500" />
            <span>VideoHelper</span>
          </h1>
          <p className="text-xl text-slate-300 mb-4">
            Everything you need to optimize your video content in one place.
          </p>
          <p className="text-slate-400">
            AI-powered tools for thumbnails, SEO, transcripts, captions, and more.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            to="/login"
            className="px-8 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Login
          </Link>
          <Link
            to="/signup"
            className="px-8 py-3 rounded-lg font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Sign Up
          </Link>
          <Link
            to="/tools"
            className="px-8 py-3 rounded-lg font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            Explore Tools
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
          <div className="space-y-2">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              ✨ Auto Chapters
            </h3>
            <p className="text-sm text-slate-400">Generate smart timestamps automatically</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              📝 AI Summary
            </h3>
            <p className="text-sm text-slate-400">Concise content summaries in seconds</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              🎯 Highlight Finder
            </h3>
            <p className="text-sm text-slate-400">Find engaging moments for shorts</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              🚀 SEO Generator
            </h3>
            <p className="text-sm text-slate-400">Optimized titles & keywords</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              💬 Transcript Gen
            </h3>
            <p className="text-sm text-slate-400">Speech to accurate text</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              📱 Social Captions
            </h3>
            <p className="text-sm text-slate-400">Engaging platform-specific captions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
