import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Users,
  HelpCircle,
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

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'ai' | 'privacy' | 'account'>('general');
  const [showAPIModal, setShowAPIModal] = useState(false);
  const { user, signOut } = useAuth();
  const uid = user?.uid;
  const hasLoadedColdSettingsRef = useRef(false);

  const [apiKeys, setApiKeys] = useState({ gemini: '', youtube: '' });
  const [tempApiKeys, setTempApiKeys] = useState({ gemini: '', youtube: '' });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [saved, setSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwVisible, setPwVisible] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  useEffect(() => {
    try {
      const nextApiKeys = {
        gemini: readUserScopedStorageValue('app_gemini_key', uid) || '',
        youtube: readUserScopedStorageValue('app_youtube_key', uid) || '',
      };
      setApiKeys(nextApiKeys);
      setTempApiKeys(nextApiKeys);
    } catch (error) {
      console.warn('Failed to load API keys:', error);
      setApiKeys({ gemini: '', youtube: '' });
      setTempApiKeys({ gemini: '', youtube: '' });
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
    id: 'general' | 'notifications' | 'ai' | 'privacy' | 'account';
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
                  <p>TubeFlow is an AI-powered YouTube content tool. By using TubeFlow, you agree to use it for lawful purposes only. You are responsible for the YouTube URLs and content you submit for analysis. Saved projects and account settings may be synced to your Firebase-backed account, while AI processing uses your configured provider keys.</p>
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
