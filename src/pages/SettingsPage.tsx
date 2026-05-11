import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Settings,
  Bell,
  Lock,
  Download,
  Eye,
  EyeOff,
  LogOut,
  ChevronRight,
  Check,
  Moon,
  Volume2,
  Save,
  X,
  ArrowLeft,
  Zap,
  FileText,
  Shield,
  TriangleAlert,
  Trash2,
  Users,
  HelpCircle,
  Search,
  Clipboard,
  Hash,
  Sparkles,
  History,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { readUserScopedStorageValue, writeUserScopedStorageValue } from '../services/browserStorage';
import {
  exportUserData,
  loadSettings,
  persistSettings,
} from '../services/settingsService';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
} from '../services/appSettings';

type SettingsTabId = 'general' | 'notifications' | 'ai' | 'help' | 'privacy' | 'account';

const SETTINGS_TAB_IDS: SettingsTabId[] = ['general', 'notifications', 'ai', 'help', 'privacy', 'account'];

type HelpCenterSection = {
  title: string;
  summary: string;
  icon: React.ElementType;
  keywords: string[];
  points: string[];
};

const HELP_CENTER_SECTIONS: HelpCenterSection[] = [
  {
    title: 'Frequently Asked Questions',
    summary: 'Fast support answers for the questions creators ask every day.',
    icon: HelpCircle,
    keywords: ['faq', 'questions', 'basics', 'tubeflow', 'failed generating', 'error'],
    points: [
      'Q: Why is Generate not returning anything? A: Confirm at least one provider key is saved in Privacy > Manage API Keys, then run Process Script again.',
      'Q: Why are my chapter, SEO, or caption tools disabled? A: Those tools unlock only after a successful processing step creates script analysis output.',
      'Q: Why did my YouTube URL fail? A: Use a public video URL with transcript availability and retry from YouTube mode.',
      'Q: Where are my saved projects? A: Sign in with the same account; synced projects are linked to your Firebase user profile.',
      'Q: Is my API key uploaded to your servers? A: No. TubeFlow stores keys in browser storage and uses them from your active session.',
    ],
  },
  {
    title: 'Getting Started',
    summary: 'The quickest path to your first complete content package.',
    icon: Sparkles,
    keywords: ['start', 'first script', 'setup', 'guide'],
    points: [
      'Open Studio, choose Script mode, and paste an idea or upload a script file.',
      'Click Process Script to unlock chapters, title ideas, summaries, and caption helpers.',
      'Save your project to keep your generated outputs and continue editing later.',
    ],
  },
  {
    title: 'API Keys & AI Providers',
    summary: 'How to connect Gemini, Groq, and YouTube processing safely.',
    icon: Zap,
    keywords: ['api', 'gemini', 'groq', 'youtube', 'key'],
    points: [
      'Go to Privacy and click Manage API Keys to add or update Gemini, Groq, and YouTube keys.',
      'API keys are stored in browser storage and used for provider calls from your session.',
      'If generation fails, confirm keys are valid, have quota, and that the selected provider is configured.',
      'If one provider is unstable, switch the thumbnail assistant provider in AI & Output and retry.',
    ],
  },
  {
    title: 'Patterns & Reuse',
    summary: 'Turn proven video structures into repeatable script systems.',
    icon: FileText,
    keywords: ['pattern', 'youtube', 'reuse', 'workflow'],
    points: [
      'Paste a public YouTube URL to extract a script pattern from transcript structure and flow.',
      'Saved patterns can be reused to generate new scripts with consistent pacing and logic.',
      'Drag a saved pattern onto a script draft in Studio to apply its structure to your content.',
    ],
  },
  {
    title: 'Generation Failures & Error Recovery',
    summary: 'Step-by-step fixes for failed generation, timeout, and invalid input errors.',
    icon: TriangleAlert,
    keywords: ['failed generation', 'timeout', 'invalid', 'provider', 'retry', 'support'],
    points: [
      'Q: Error says invalid API key. A: Reopen Manage API Keys, paste the key again without extra spaces, save, and retry.',
      'Q: Error says quota or rate limit reached. A: Wait briefly, reduce repeated requests, or switch to another configured provider.',
      'Q: Generation times out on long input. A: Shorten the script or process in parts, then combine results in the editor.',
      'Q: YouTube transcript could not be read. A: Verify the URL is public and supports transcripts in the source video.',
      'Q: Output quality is poor or incomplete. A: Re-run with clearer input context and use Detailed output level in AI & Output settings.',
      'Q: Error persists after retries. A: Refresh the app, confirm sign-in state, and test with a short known-good sample input.',
    ],
  },
  {
    title: 'Privacy & Account Data',
    summary: 'What is local, what is synced, and how to control both.',
    icon: Shield,
    keywords: ['privacy', 'data', 'firebase', 'account', 'security'],
    points: [
      'Synced settings and saved projects are linked to your signed-in Firebase account.',
      'Local browser items can include API keys and lightweight session-level preferences.',
      'From Account settings, you can export user data or request deletion of synced account data.',
    ],
  },
  {
    title: 'Troubleshooting',
    summary: 'Escalation checklist used by support when processing or generation fails.',
    icon: TriangleAlert,
    keywords: ['error', 'troubleshoot', 'fix', 'processing', 'url', 'failed generating', 'support'],
    points: [
      'Step 1: Confirm mode and input format are correct (Script mode for text/files, YouTube mode for video links).',
      'Step 2: Verify keys and provider configuration in Privacy and AI & Output settings.',
      'Step 3: Retry with a shorter input to rule out payload-size failures.',
      'Step 4: Refresh and sign in again to reinitialize user-scoped settings and storage.',
      'Step 5: If still failing, copy the exact error message and the action that triggered it for support triage.',
    ],
  },
];

function getRequestedSettingsTab(search: string): SettingsTabId | null {
  const value = new URLSearchParams(search).get('tab');
  if (!value) return null;
  return SETTINGS_TAB_IDS.includes(value as SettingsTabId) ? (value as SettingsTabId) : null;
}

const SettingsPage = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => getRequestedSettingsTab(location.search) ?? 'general');
  const [showAPIModal, setShowAPIModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const { user, signOut, deleteAccountData } = useAuth();
  const uid = user?.uid;
  const hasLoadedColdSettingsRef = useRef(false);

  const [apiKeys, setApiKeys] = useState({ gemini: '', groq: '', youtube: '' });
  const [tempApiKeys, setTempApiKeys] = useState({ gemini: '', groq: '', youtube: '' });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [saved, setSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwVisible, setPwVisible] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [openHelpSection, setOpenHelpSection] = useState<string | null>(HELP_CENTER_SECTIONS[0]?.title ?? null);
  const [supportReportCopied, setSupportReportCopied] = useState(false);
  const navigate = useNavigate();

  const normalizedHelpQuery = helpQuery.trim().toLowerCase();
  const helpSections = !normalizedHelpQuery
    ? HELP_CENTER_SECTIONS
    : HELP_CENTER_SECTIONS.filter((section) => {
      const text = [
        section.title,
        section.summary,
        ...section.keywords,
        ...section.points,
      ].join(' ').toLowerCase();
      return text.includes(normalizedHelpQuery);
    });

  useEffect(() => {
    if (helpSections.length === 0) {
      setOpenHelpSection(null);
      return;
    }

    if (!openHelpSection || !helpSections.some((section) => section.title === openHelpSection)) {
      setOpenHelpSection(helpSections[0].title);
    }
  }, [helpSections, openHelpSection]);

  useEffect(() => {
    const requestedTab = getRequestedSettingsTab(location.search);
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [location.search, activeTab]);

  const deleteConfirmationTarget = user?.email?.trim() || user?.uid || '';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleCopySupportReport = async () => {
    const reportLines = [
      'TubeFlow Support Report',
      `Generated At: ${new Date().toISOString()}`,
      `Page: ${window.location.pathname}${window.location.search}`,
      `Signed In: ${user ? 'yes' : 'no'}`,
      `User ID (last 8): ${uid ? uid.slice(-8) : 'not-signed-in'}`,
      `Help Search Query: ${helpQuery || 'none'}`,
      `Browser: ${navigator.userAgent}`,
      'Issue Type: Generation failed / processing error',
      'Last Action Attempted: Please describe exactly what you clicked before the error.',
      'Error Message: Please paste the full error text shown in the app.',
      'Troubleshooting Tried: key check, provider switch, refresh, re-login, shorter input.',
    ];

    try {
      await navigator.clipboard.writeText(reportLines.join('\n'));
      setSupportReportCopied(true);
      window.setTimeout(() => setSupportReportCopied(false), 1800);
    } catch (error) {
      console.warn('Failed to copy support report:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirmationTarget) {
      setDeleteAccountError('Missing account identifier. Sign in again and retry.');
      return;
    }

    if (deleteConfirmValue.trim() !== deleteConfirmationTarget) {
      setDeleteAccountError(`Type ${deleteConfirmationTarget} exactly to confirm.`);
      return;
    }

    setDeleteAccountBusy(true);
    setDeleteAccountError('');

    try {
      await deleteAccountData();
      navigate('/login', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account data.';
      setDeleteAccountError(message);
    } finally {
      setDeleteAccountBusy(false);
    }
  };

  useEffect(() => {
    try {
      const nextApiKeys = {
        gemini: readUserScopedStorageValue('app_gemini_key', uid) || '',
        groq: readUserScopedStorageValue('app_groq_key', uid) || '',
        youtube: readUserScopedStorageValue('app_youtube_key', uid) || '',
      };
      setApiKeys(nextApiKeys);
      setTempApiKeys(nextApiKeys);
    } catch (error) {
      console.warn('Failed to load API keys:', error);
      setApiKeys({ gemini: '', groq: '', youtube: '' });
      setTempApiKeys({ gemini: '', groq: '', youtube: '' });
    }
  }, [uid]);

  useEffect(() => {
    let isActive = true;

    hasLoadedColdSettingsRef.current = false;
    setSettings(DEFAULT_APP_SETTINGS);

    void loadSettings(uid)
      .then((loadedSettings) => {
        if (!isActive) {
          return;
        }

        setSettings(loadedSettings);
        hasLoadedColdSettingsRef.current = true;
      })
      .catch((error) => {
        console.warn('Failed to load synced settings:', error);
        if (!isActive) {
          return;
        }

        setSettings(DEFAULT_APP_SETTINGS);
        hasLoadedColdSettingsRef.current = true;
      });

    return () => {
      isActive = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !hasLoadedColdSettingsRef.current) {
      return;
    }

    let isCancelled = false;
    let savedTimer: number | undefined;

    void persistSettings(settings, uid)
      .then(() => {
        if (isCancelled) {
          return;
        }

        setSaved(true);
        if (savedTimer) {
          window.clearTimeout(savedTimer);
        }
        savedTimer = window.setTimeout(() => setSaved(false), 2000);
      })
      .catch((error) => {
        console.warn('Failed to sync settings:', error);
      });

    return () => {
      isCancelled = true;
      if (savedTimer) {
        window.clearTimeout(savedTimer);
      }
    };
  }, [settings, uid]);

  const saveAPIKeys = () => {
    writeUserScopedStorageValue('app_gemini_key', tempApiKeys.gemini, uid);
    writeUserScopedStorageValue('app_groq_key', tempApiKeys.groq, uid);
    writeUserScopedStorageValue('app_youtube_key', tempApiKeys.youtube, uid);
    setApiKeys(tempApiKeys);
    setShowAPIModal(false);
  };

  const updateSetting = (path: string[], value: unknown) => {
    setSettings(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      let current = updated;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return updated;
    });
  };

  const ToggleSwitch = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        value ? 'bg-emerald-500' : 'bg-slate-700'
      }`}
    >
      <motion.div
        className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
        animate={{ x: value ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
    </button>
  );

  const SettingRow = ({
    icon: Icon,
    label,
    description,
    children,
  }: {
    icon: React.ElementType;
    label: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-4 px-5 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors rounded-lg mb-2">
      <div className="flex items-center gap-3 flex-1">
        <Icon className="w-5 h-5 text-emerald-500" />
        <div>
          <p className="font-medium text-white">{label}</p>
          {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: 'general' | 'notifications' | 'ai' | 'help' | 'privacy' | 'account';
    label: string;
    icon: React.ElementType;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
        activeTab === id
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="w-6 h-6 text-emerald-500" />
                Settings
              </h1>
            </div>
          </div>

          {saved && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 text-emerald-400 text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Saved
            </motion.div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto pt-24 px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="space-y-2 bg-slate-900/50 rounded-xl p-2 border border-slate-800 sticky top-24">
              <TabButton id="general" label="General" icon={Settings} />
              <TabButton id="notifications" label="Notifications" icon={Bell} />
              <TabButton id="ai" label="AI & Output" icon={Sparkles} />
              <TabButton id="help" label="Help Center" icon={HelpCircle} />
              <TabButton id="privacy" label="Privacy" icon={Shield} />
              <TabButton id="account" label="Account" icon={Users} />
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-8"
            >
              {/* General Settings */}
              {activeTab === 'general' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">General Settings</h2>

                  <SettingRow
                    icon={Moon}
                    label="Dark Mode"
                    description="Easier on the eyes during long content sessions"
                  >
                    <ToggleSwitch
                      value={settings.general.darkMode}
                      onChange={(v) => updateSetting(['general', 'darkMode'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Save}
                    label="Auto-Save Results"
                    description="Automatically save AI-generated outputs to your session"
                  >
                    <ToggleSwitch
                      value={settings.general.autoSave}
                      onChange={(v) => updateSetting(['general', 'autoSave'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={HelpCircle}
                    label="Show Tips & Hints"
                    description="Display helpful tips while using TubeFlow tools"
                  >
                    <ToggleSwitch
                      value={settings.general.showHints}
                      onChange={(v) => updateSetting(['general', 'showHints'], v)}
                    />
                  </SettingRow>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'notifications' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">Notification Preferences</h2>

                  <SettingRow
                    icon={CheckCheck}
                    label="Processing Complete"
                    description="Notify when AI finishes analyzing your video content"
                  >
                    <ToggleSwitch
                      value={settings.notifications.processingComplete}
                      onChange={(v) => updateSetting(['notifications', 'processingComplete'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Bell}
                    label="Email Notifications"
                    description="Receive weekly content tips and TubeFlow updates"
                  >
                    <ToggleSwitch
                      value={settings.notifications.email}
                      onChange={(v) => updateSetting(['notifications', 'email'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Volume2}
                    label="Sound Alerts"
                    description="Play a sound when AI analysis is complete"
                  >
                    <ToggleSwitch
                      value={settings.notifications.sound}
                      onChange={(v) => updateSetting(['notifications', 'sound'], v)}
                    />
                  </SettingRow>

                  <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-300">
                      💡 <span className="font-medium">Tip:</span> Enable processing alerts so you know exactly when your transcript, chapters, or SEO output is ready.
                    </p>
                  </div>
                </div>
              )}

              {/* AI & Output Settings */}
              {activeTab === 'ai' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">AI & Output Preferences</h2>

                  <SettingRow
                    icon={Clipboard}
                    label="Auto-Copy to Clipboard"
                    description="Automatically copy AI results as soon as they're ready"
                  >
                    <ToggleSwitch
                      value={settings.ai.autoCopy}
                      onChange={(v) => updateSetting(['ai', 'autoCopy'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Hash}
                    label="Show Word Count"
                    description="Display word and character count on all generated outputs"
                  >
                    <ToggleSwitch
                      value={settings.ai.showWordCount}
                      onChange={(v) => updateSetting(['ai', 'showWordCount'], v)}
                    />
                  </SettingRow>

                  <div className="pt-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Output Detail Level</h3>
                    <p className="text-xs text-slate-400 mb-4">Controls how thorough AI responses are for summaries, chapters, and captions.</p>
                    <div className="space-y-2">
                      {[
                        { value: 'concise', label: 'Concise', desc: 'Short, punchy outputs — great for social captions' },
                        { value: 'standard', label: 'Standard', desc: 'Balanced detail for most use cases' },
                        { value: 'detailed', label: 'Detailed', desc: 'In-depth analysis — ideal for summaries and SEO' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                          <input
                            type="radio"
                            name="outputDetail"
                            value={option.value}
                            checked={settings.ai.outputDetail === option.value}
                            onChange={(e) => updateSetting(['ai', 'outputDetail'], e.target.value)}
                            className="w-4 h-4 mt-0.5 accent-emerald-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-white">{option.label}</span>
                            <p className="text-xs text-slate-400 mt-0.5">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Thumbnail Assistant Provider</h3>
                    <p className="text-xs text-slate-400 mb-4">Choose which model handles chat commands in the thumbnail editor.</p>
                    <div className="space-y-2">
                      {[
                        { value: 'groq', label: 'Groq', desc: 'Fast command generation through the Groq API.' },
                        { value: 'gemini', label: 'Gemini', desc: 'Gemini-based command generation for thumbnail edits.' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                          <input
                            type="radio"
                            name="thumbnailAssistantProvider"
                            value={option.value}
                            checked={settings.ai.thumbnailAssistantProvider === option.value}
                            onChange={(e) => updateSetting(['ai', 'thumbnailAssistantProvider'], e.target.value)}
                            className="w-4 h-4 mt-0.5 accent-emerald-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-white">{option.label}</span>
                            <p className="text-xs text-slate-400 mt-0.5">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Help Center */}
              {activeTab === 'help' && (
                <div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={helpQuery}
                        onChange={(e) => setHelpQuery(e.target.value)}
                        placeholder="Search for topics like API keys, patterns, privacy..."
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
                      />
                    </div>

                    <h2 className="mt-5 text-3xl font-bold text-white">Advice and answers from the King Slayer Support Team</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Everything below is specific to TubeFlow workflows, data handling, and day-to-day creator usage.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleCopySupportReport()}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                      >
                        <Clipboard className="h-3.5 w-3.5" />
                        {supportReportCopied ? 'Support Report Copied' : 'Copy Support Report'}
                      </button>
                      <p className="text-xs text-slate-500">
                        Share this report with support when generation fails so triage is faster.
                      </p>
                    </div>
                  </div>

                  {helpSections.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
                      No help articles matched your search. Try terms like script, youtube, pattern, privacy, or api keys.
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {helpSections.map((section) => {
                        const Icon = section.icon;
                        const isOpen = openHelpSection === section.title;
                        return (
                          <div key={section.title} className="rounded-2xl border border-slate-700 bg-slate-900/60">
                            <button
                              type="button"
                              onClick={() => setOpenHelpSection(isOpen ? null : section.title)}
                              className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-emerald-400">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                                  <p className="mt-1 text-sm text-slate-400">{section.summary}</p>
                                </div>
                              </div>
                              <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: 'easeOut' }}
                                  className="overflow-hidden"
                                >
                                  <ul className="space-y-2 border-t border-slate-700 px-5 py-4 text-sm text-slate-300">
                                    {section.points.map((point) => (
                                      <li key={point} className="flex gap-2 leading-relaxed">
                                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Privacy Settings */}
              {activeTab === 'privacy' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">Privacy & Security</h2>

                  <SettingRow
                    icon={Zap}
                    label="Share Usage Analytics"
                    description="Help improve TubeFlow with anonymous usage data"
                  >
                    <ToggleSwitch
                      value={settings.privacy.shareAnalytics}
                      onChange={(v) => updateSetting(['privacy', 'shareAnalytics'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={History}
                    label="Store Analysis History"
                    description="Keep a local history of your AI-generated results"
                  >
                    <ToggleSwitch
                      value={settings.privacy.storeHistory}
                      onChange={(v) => updateSetting(['privacy', 'storeHistory'], v)}
                    />
                  </SettingRow>

                  <div className="mt-8 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
                    <h3 className="font-semibold text-white mb-3">API Keys</h3>
                    <p className="text-xs text-slate-400 mb-3">Manage the API keys used by TubeFlow's AI features. Keys are stored locally and never sent to our servers.</p>
                    <button
                      onClick={() => {
                        setTempApiKeys(apiKeys);
                        setShowAPIModal(true);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-left"
                    >
                      <span className="text-sm">Manage API Keys</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/30 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white">Terms & Privacy</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          The main legal and privacy rules for using TubeFlow.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowTermsModal(true)}
                        className="shrink-0 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                      >
                        Read Full Policy
                      </button>
                    </div>

                    <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
                      <div>
                        <p className="font-medium text-white">Terms of Service</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Use TubeFlow only for lawful work and only with content you have the right to submit, analyze, adapt, or store.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-white">Privacy Policy</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Synced settings and saved projects can live in your Firebase account, while local browser items like API keys and lightweight analytics stay on this device.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-white">API Key Usage</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Your API keys are stored locally in the browser and used directly for provider requests. They are not stored on our servers.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-white">Data Deletion</p>
                        <p className="mt-1 text-xs text-slate-400">
                          You can clear browser data locally, and synced account data can be removed from your signed-in Firebase account.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Settings */}
              {activeTab === 'account' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">Account</h2>

                  <div className="bg-slate-800/50 rounded-lg p-6 mb-6 border border-slate-700 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Signed in as</p>
                        <p className="text-lg font-semibold text-white">{user?.displayName || 'TubeFlow User'}</p>
                        <p className="text-sm text-slate-400">{user?.email || 'No email available'}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-emerald-400">Unique User ID</p>
                      <p className="mt-1 break-all text-sm font-mono text-white">{user?.uid || 'Sign in to generate your user ID'}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => { setPwError(''); setPwSuccess(false); setPwForm({ current: '', next: '', confirm: '' }); setShowPasswordModal(true); }}
                    className="flex items-center justify-between py-4 px-5 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors rounded-lg mb-2 w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-emerald-500" />
                      <p className="font-medium text-white">Change Password</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>

                  <button
                    onClick={() => { void exportUserData(uid); }}
                    className="flex items-center justify-between py-4 px-5 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors rounded-lg mb-2 w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Download className="w-5 h-5 text-emerald-500" />
                      <div>
                        <p className="font-medium text-white">Export My Data</p>
                        <p className="text-xs text-slate-400 mt-1">Download all your saved outputs and settings</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>

                  <button
                    onClick={() => setShowTermsModal(true)}
                    className="flex items-center justify-between py-4 px-5 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors rounded-lg mb-2 w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-emerald-500" />
                      <p className="font-medium text-white">Terms & Privacy Policy</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>

                  <div className="mt-8 pt-8 border-t border-slate-700">
                    <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <TriangleAlert className="mt-0.5 h-5 w-5 text-red-300" />
                        <div>
                          <p className="font-semibold text-red-200">Delete Synced Data And Disable This Account</p>
                          <p className="mt-1 text-sm text-red-100/80">
                            This permanently deletes your Firebase profile, saved projects, and avatar storage for this UID. TubeFlow keeps only a minimal disabled-account record so the same account cannot claim a new free trial or reset credits later.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setDeleteConfirmValue('');
                          setDeleteAccountError('');
                          setShowDeleteAccountModal(true);
                        }}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/30"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Data And Disable Account
                      </button>
                    </div>

                    <button
                      onClick={handleSignOut}
                      className="w-full px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-semibold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>

                  <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700 text-center">
                    <p className="text-xs text-slate-400">
                      TubeFlow v1.2.0 • AI-powered YouTube content tools
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* API Keys Modal */}
      <AnimatePresence>
        {showAPIModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAPIModal(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-700 rounded-xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Manage API Keys</h3>
                <button
                  onClick={() => setShowAPIModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={tempApiKeys.gemini}
                    onChange={(e) => setTempApiKeys({ ...tempApiKeys, gemini: e.target.value })}
                    placeholder="Enter your Gemini API key"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 hover:border-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">Get your key from console.cloud.google.com</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Groq API Key
                  </label>
                  <input
                    type="password"
                    value={tempApiKeys.groq}
                    onChange={(e) => setTempApiKeys({ ...tempApiKeys, groq: e.target.value })}
                    placeholder="Enter your Groq API key"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 hover:border-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">Get your key from console.groq.com</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    YouTube API Key
                  </label>
                  <input
                    type="password"
                    value={tempApiKeys.youtube}
                    onChange={(e) => setTempApiKeys({ ...tempApiKeys, youtube: e.target.value })}
                    placeholder="Enter your YouTube API key"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 hover:border-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">Get your key from console.cloud.google.com</p>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-6">
                <p className="text-xs text-slate-300">
                  <span className="font-semibold">🔒 Private:</span> Your API keys are stored locally in your browser and never sent to our servers.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAPIModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAPIKeys}
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Keys
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-700 rounded-xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Change Password</h3>
                <button onClick={() => setShowPasswordModal(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pwSuccess ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-emerald-400 font-semibold">Password updated successfully!</p>
                  <button onClick={() => setShowPasswordModal(false)} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Current Password</label>
                      <div className="relative">
                        <input
                          type={pwVisible ? 'text' : 'password'}
                          value={pwForm.current}
                          onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                          placeholder="Enter current password"
                          className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                        />
                        <button type="button" onClick={() => setPwVisible(!pwVisible)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200">
                          {pwVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">New Password</label>
                      <input
                        type={pwVisible ? 'text' : 'password'}
                        value={pwForm.next}
                        onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                        placeholder="Enter new password (min 8 chars)"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm New Password</label>
                      <input
                        type={pwVisible ? 'text' : 'password'}
                        value={pwForm.confirm}
                        onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                        placeholder="Repeat new password"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                    {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowPasswordModal(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setPwError('');
                        if (!pwForm.current) { setPwError('Enter your current password.'); return; }
                        if (pwForm.next.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
                        if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
                        // Store a hashed marker (no real auth backend — store locally)
                        writeUserScopedStorageValue('tubeflow_pw_hash', btoa(pwForm.next), uid);
                        setPwSuccess(true);
                      }}
                      className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Update Password
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Terms & Privacy Modal */}
      <AnimatePresence>
        {showDeleteAccountModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!deleteAccountBusy) {
                  setShowDeleteAccountModal(false);
                }
              }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-red-500/30 bg-slate-900 p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Delete Account Data</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    This wipes all Firebase data tied to your current UID and signs you out. Authentication is retained but the account is disabled, so signing back in with the same email will not restore a free trial or fresh credits.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!deleteAccountBusy) {
                      setShowDeleteAccountModal(false);
                    }
                  }}
                  className="rounded-lg p-1 transition-colors hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-100/90">
                <p>Type <span className="font-mono font-semibold text-white">{deleteConfirmationTarget}</span> to confirm this permanent action.</p>
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-200">
                Confirmation
                <input
                  type="text"
                  value={deleteConfirmValue}
                  onChange={(event) => setDeleteConfirmValue(event.target.value)}
                  disabled={deleteAccountBusy}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-2 ring-slate-900 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={deleteConfirmationTarget}
                />
              </label>

              {deleteAccountError && (
                <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {deleteAccountError}
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowDeleteAccountModal(false)}
                  disabled={deleteAccountBusy}
                  className="flex-1 rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccountBusy}
                  className="flex-1 rounded-lg border border-red-400/40 bg-red-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteAccountBusy ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTermsModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTermsModal(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-700 rounded-xl p-8 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Terms & Privacy Policy</h3>
                <button onClick={() => setShowTermsModal(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-white mb-2">Terms of Service</h4>
                  <p>TubeFlow is an AI-powered content tool provided by King Slayer Entertainment. By using TubeFlow, you agree to use it only for lawful purposes and only with content you have the right to submit, analyze, adapt, or store. You are responsible for any YouTube URLs, scripts, media, prompts, and other materials you submit through the app. Saved projects and account settings may be synced to your Firebase-backed account, while AI processing uses your configured provider keys.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Copyright & Intellectual Property</h4>
                  <p>Copyright © King Slayer Entertainment. The TubeFlow application, branding, interface, templates, and proprietary workflows are the intellectual property of King Slayer Entertainment. Unauthorized reproduction, redistribution, reverse engineering, or commercial reuse of the application or its proprietary materials is prohibited.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Privacy Policy</h4>
                  <p>TubeFlow uses a hot and cold data split. Durable account settings and saved projects are stored in your Firebase account so they persist across devices. Local-only browser data such as API keys, lightweight analytics, and the demo password marker stay on this device unless you remove them.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">API Key Usage</h4>
                  <p>Your API keys are stored only in your browser and are used directly in API calls. We recommend setting usage limits on your API keys in the respective provider consoles.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Data Deletion</h4>
                  <p>You can delete local browser data at any time by clearing site storage. Synced projects and settings can be removed from your signed-in account by deleting the associated records in Firebase.</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700">
                <button onClick={() => setShowTermsModal(false)} className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
                  I Understand
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
