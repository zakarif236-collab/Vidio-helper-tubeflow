import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  Play,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
  Youtube,
  ScanText,
  BookMarked,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserAvatarMenu from '../components/UserAvatarMenu';
import { listProjects, deleteProject } from '../services/projectService';
import type { Project } from '../types/firestore';

const tools = [
  {
    title: 'Script Generator',
    description: 'Turn a rough idea into a full 10–20 minute video script with a clear structure and strong flow.',
    icon: Wand2,
  },
  {
    title: 'SEO & Titles',
    description: 'Generate optimised titles, hooks, descriptions and keywords to support your video.',
    icon: Sparkles,
  },
  {
    title: 'Chapters & Summary',
    description: 'Break your script into clear sections with timestamps and a clean written summary.',
    icon: Clock3,
  },
  {
    title: 'Pattern Extractor',
    description: 'Analyse any YouTube video to extract its script structure as a reusable pattern for future content.',
    icon: FileText,
  },
];

const HomePage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  useEffect(() => {
    if (!user) { setProjects([]); return; }
    setProjectsLoading(true);
    listProjects(user.uid)
      .then(setProjects)
      .catch(console.error)
      .finally(() => setProjectsLoading(false));
  }, [user]);

  const handleDelete = async (projectId: string) => {
    if (!user) return;
    await deleteProject(user.uid, projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-black">
              <Play className="h-5 w-5 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Tubeflow</h1>
              <p className="text-xs text-slate-400">Simple AI video workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <UserAvatarMenu />
            ) : (
              <Link to="/login" className="text-sm text-slate-300 transition hover:text-white">
                Sign in
              </Link>
            )}
            <Link
              to="/studio"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Open Studio
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-400">
              <Zap className="h-4 w-4" />
              AI Script Studio
            </div>

            <h2 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              <span className="text-white">Turn any idea into a</span>
              <br />
              <span className="text-emerald-400">powerful 10–20 min script</span>
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Tubeflow takes your rough idea and builds a full long-form video script — structured, clear, and ready to record. Then layer on SEO titles, chapters, highlights, and captions to complete the whole video in one place.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Or paste a <span className="font-semibold text-slate-200">YouTube URL</span> — Tubeflow reads the transcript, analyses the structure and logic with AI, and turns it into a <span className="font-semibold text-emerald-400">reusable Script Pattern</span> you can apply to generate a brand-new script or guide your own writing later.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/studio"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400"
              >
                Start now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/signup"
                className="rounded-lg border border-slate-700 px-5 py-3 font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/20">
            <p className="mb-5 text-xs font-bold uppercase tracking-widest text-slate-500">Two ways to use Tubeflow</p>
            <div className="space-y-4">

              {/* Path 1: Idea → Script */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-300">Idea → Full Script</p>
                </div>
                <p className="text-sm text-slate-300">Give Tubeflow a topic or rough idea. AI builds a structured 10–20 min script with a strong hook, clear sections, and a solid ending.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Hook', 'Sections', 'Flow', 'Ending', 'SEO', 'Chapters', 'Captions'].map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Path 2: YouTube URL → Pattern */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-400" />
                  <p className="text-sm font-bold text-red-300">YouTube URL → Script Pattern</p>
                </div>
                <p className="text-sm text-slate-300">Paste any YouTube URL. AI reads the transcript, scans the structure, pacing, and logic, then saves it as a reusable pattern.</p>
                <div className="mt-3 rounded-lg bg-slate-900 p-3">
                  <p className="text-xs font-semibold text-slate-400">Use the pattern to:</p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-400">
                    <li className="flex items-center gap-1.5"><span className="text-emerald-400">→</span> Generate a brand-new script in the same style</li>
                    <li className="flex items-center gap-1.5"><span className="text-emerald-400">→</span> Improve or guide your own script writing</li>
                    <li className="flex items-center gap-1.5"><span className="text-emerald-400">→</span> Reuse it across future videos anytime</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-white">All the tools around your script</h3>
              <p className="text-sm text-slate-400">Script is the core — everything else completes the video end to end.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300 md:flex">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              Full workflow
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div key={tool.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">{tool.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{tool.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* YouTube URL → Pattern section */}
        <section className="mt-12">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="grid lg:grid-cols-2">
              {/* Left: explanation */}
              <div className="p-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400">
                  <Youtube className="h-4 w-4" />
                  YouTube URL Intelligence
                </div>
                <h3 className="text-2xl font-bold text-white">
                  Paste a YouTube URL.
                  <br />
                  <span className="text-emerald-400">Get a reusable script pattern.</span>
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Tubeflow reads the video's transcript, scans the structure, logic, pacing, and narrative flow, then extracts it as a reusable <strong className="text-white">Script Pattern</strong>.
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  Use that pattern later to generate a brand-new script in the same proven style, or as a guide to improve your own writing — without copying a word of the original.
                </p>
                <Link
                  to="/studio"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
                >
                  Try it in the Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Right: step-by-step flow */}
              <div className="border-t border-slate-800 bg-slate-950 p-8 lg:border-l lg:border-t-0">
                <p className="mb-5 text-xs font-bold uppercase tracking-widest text-slate-500">How it works</p>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                      <Youtube className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Paste the YouTube URL</p>
                      <p className="mt-0.5 text-xs text-slate-400">Any public YouTube video with a transcript works as input.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <ScanText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">AI scans the script</p>
                      <p className="mt-0.5 text-xs text-slate-400">Tubeflow analyses structure, logic, pacing, hooks, and narrative flow from the full transcript.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <BookMarked className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Pattern is saved</p>
                      <p className="mt-0.5 text-xs text-slate-400">The extracted structure is stored as a named Script Pattern in your workspace.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Reuse it anytime</p>
                      <p className="mt-0.5 text-xs text-slate-400">Apply the pattern to generate a new script or use it as a writing guide for your own content.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {user && (
          <section className="mt-12">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-emerald-400" />
                <h3 className="text-2xl font-bold text-white">My Projects</h3>
              </div>
              <Link to="/studio" className="text-sm text-emerald-400 hover:text-emerald-300 transition">
                + New project
              </Link>
            </div>
            {projectsLoading ? (
              <p className="text-sm text-slate-400">Loading projects…</p>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                <p className="text-slate-400 text-sm">No saved projects yet.</p>
                <Link to="/studio" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition">
                  Open Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${project.sourceType === 'youtube' ? 'bg-red-500/15 text-red-300' : 'bg-sky-500/15 text-sky-300'}`}>
                          {project.sourceType === 'youtube' ? 'YouTube' : 'Script'}
                        </span>
                        <p className="mt-2 text-sm font-semibold text-white leading-snug line-clamp-2">{project.title}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{project.summary}</p>
                    <p className="text-[11px] text-slate-500">{project.chapters.length} chapters</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h3 className="text-2xl font-bold text-white">Ready to write your next script?</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Open the studio, drop in an idea or a YouTube URL, and let Tubeflow build the script, the structure, and the pattern — all in one place.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/studio" className="rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400">
              Go to Studio
            </Link>
            {!user && (
              <Link to="/login" className="rounded-lg border border-slate-700 px-5 py-3 font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white">
                Sign in
              </Link>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default HomePage;

