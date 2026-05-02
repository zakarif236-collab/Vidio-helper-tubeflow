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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserAvatarMenu from '../components/UserAvatarMenu';
import { listProjects, deleteProject } from '../services/projectService';
import type { Project } from '../types/firestore';

const tools = [
  {
    title: 'Video Summary',
    description: 'Get a clean summary and key points from long videos.',
    icon: FileText,
  },
  {
    title: 'Auto Chapters',
    description: 'Break content into clear sections and timestamps.',
    icon: Clock3,
  },
  {
    title: 'SEO Assistant',
    description: 'Generate better titles, hooks and descriptions.',
    icon: Sparkles,
  },
  {
    title: 'Content Ideas',
    description: 'Turn one idea into a more complete video plan.',
    icon: Wand2,
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Clean and organized workflow
            </div>

            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Process your videos faster with a simple setup
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Tubeflow helps you turn videos into summaries, chapters, ideas and SEO content without a busy or distracting interface.
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
            <h3 className="mb-4 text-lg font-semibold text-white">Why this works</h3>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm font-semibold text-white">One place for core tasks</p>
                <p className="mt-1 text-sm text-slate-400">Open the studio and process links or scripts without jumping between pages.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm font-semibold text-white">Clear output structure</p>
                <p className="mt-1 text-sm text-slate-400">Summaries, highlights and SEO are grouped in a straightforward layout.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm font-semibold text-white">Built for speed</p>
                <p className="mt-1 text-sm text-slate-400">Less visual clutter, faster access to the main actions you actually use.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-white">Main tools</h3>
              <p className="text-sm text-slate-400">A basic overview of the most useful features.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300 md:flex">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              Organized layout
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
          <h3 className="text-2xl font-bold text-white">Ready to use the cleaner version?</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            The homepage has been simplified and organized to feel more practical and easier to use.
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

