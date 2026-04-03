import React from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  FileText,
  Lightbulb,
  LogIn,
  MessageSquare,
  Play,
  Sparkles,
  Zap,
} from 'lucide-react';

const HomePage = () => {
  const tools = [
    {
      name: 'Idea to Video',
      description: 'Build a full video package from a single idea.',
      icon: Lightbulb,
      path: '/idea-to-video',
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      name: 'Auto Chapters',
      description: 'Generate clean chapter timestamps automatically.',
      icon: Clock,
      path: '/tools/auto-chapters',
      accent: 'from-sky-500 to-cyan-500',
    },
    {
      name: 'AI Summary',
      description: 'Turn long content into a short usable summary.',
      icon: FileText,
      path: '/tools/ai-summary',
      accent: 'from-violet-500 to-fuchsia-500',
    },
    {
      name: 'Highlight Finder',
      description: 'Pull the moments worth clipping and posting.',
      icon: Zap,
      path: '/tools/highlight-finder',
      accent: 'from-amber-500 to-orange-500',
    },
    {
      name: 'Transcript Gen',
      description: 'Convert spoken content into editable text.',
      icon: MessageSquare,
      path: '/tools/transcript-gen',
      accent: 'from-rose-500 to-pink-500',
    },
    {
      name: 'SEO Generator',
      description: 'Create titles, keywords, and descriptions fast.',
      icon: Sparkles,
      path: '/tools/seo-generator',
      accent: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/45 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
              <Play className="h-5 w-5 fill-current text-black" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Tubeflow</p>
              <h1 className="text-lg font-semibold text-white">Home</h1>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.28em] text-slate-400">Workspace</p>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Open a tool and start working.</h2>
            <p className="mt-3 text-base text-slate-400 sm:text-lg">
              Home now goes straight to your tool dashboard instead of a marketing front page.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link
                key={tool.name}
                to={tool.path}
                className="group rounded-2xl border border-slate-800 bg-slate-900/55 p-6 transition-all hover:-translate-y-1 hover:border-slate-700 hover:bg-slate-900"
              >
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.accent}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white">{tool.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{tool.description}</p>
                <span className="mt-5 inline-flex text-sm font-semibold text-emerald-400 transition-transform group-hover:translate-x-1">
                  Open tool
                </span>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default HomePage;
