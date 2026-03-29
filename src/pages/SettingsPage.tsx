import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Settings,
  Bell,
  Lock,
  Palette,
  Download,
  Keyboard,
  Eye,
  LogOut,
  ChevronRight,
  Check,
  Moon,
  Sun,
  Volume2,
  Save,
  X,
  ArrowLeft,
  Zap,
  FileText,
  Shield,
  Users,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsState {
  theme: 'dark' | 'light';
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
  privacy: {
    shareAnalytics: boolean;
    allowCookies: boolean;
    publicProfile: boolean;
  };
  editor: {
    autoSave: boolean;
    gridSnap: boolean;
    showRulers: boolean;
    defaultQuality: 'high' | 'medium' | 'low';
  };
  keyboard: {
    showHints: boolean;
    darkMode: boolean;
  };
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'editor' | 'account'>('general');
  const [showAPIModal, setShowAPIModal] = useState(false);
  const [apiKeys, setApiKeys] = useState(() => {
    try {
      return {
        gemini: localStorage.getItem('app_gemini_key') || '',
        youtube: localStorage.getItem('app_youtube_key') || '',
      };
    } catch (e) {
      console.warn('Failed to load API keys:', e);
      return { gemini: '', youtube: '' };
    }
  });
  const [tempApiKeys, setTempApiKeys] = useState(() => {
    try {
      return {
        gemini: localStorage.getItem('app_gemini_key') || '',
        youtube: localStorage.getItem('app_youtube_key') || '',
      };
    } catch (e) {
      return { gemini: '', youtube: '' };
    }
  });
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem('tubeflow_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          theme: parsed.theme || 'dark',
          notifications: parsed.notifications || {
            email: true,
            push: false,
            sound: true,
          },
          privacy: parsed.privacy || {
            shareAnalytics: true,
            allowCookies: true,
            publicProfile: false,
          },
          editor: parsed.editor || {
            autoSave: true,
            gridSnap: true,
            showRulers: false,
            defaultQuality: 'high',
          },
          keyboard: parsed.keyboard || {
            showHints: true,
            darkMode: true,
          },
        };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return {
      theme: 'dark',
      notifications: {
        email: true,
        push: false,
        sound: true,
      },
      privacy: {
        shareAnalytics: true,
        allowCookies: true,
        publicProfile: false,
      },
      editor: {
        autoSave: true,
        gridSnap: true,
        showRulers: false,
        defaultQuality: 'high',
      },
      keyboard: {
        showHints: true,
        darkMode: true,
      },
    };
  });

  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('tubeflow_settings', JSON.stringify(settings));
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [settings]);

  const saveAPIKeys = () => {
    localStorage.setItem('app_gemini_key', tempApiKeys.gemini);
    localStorage.setItem('app_youtube_key', tempApiKeys.youtube);
    setApiKeys(tempApiKeys);
    setShowAPIModal(false);
  };

  const updateSetting = (path: string[], value: any) => {
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
    id: 'general' | 'notifications' | 'privacy' | 'editor' | 'account';
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
              <TabButton id="editor" label="Editor" icon={Palette} />
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
                    description="Easier on the eyes during night editing sessions"
                  >
                    <ToggleSwitch
                      value={settings.keyboard.darkMode}
                      onChange={(v) => updateSetting(['keyboard', 'darkMode'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Download}
                    label="Auto-Save Workspace"
                    description="Automatically save your editing progress"
                  >
                    <ToggleSwitch
                      value={settings.editor.autoSave}
                      onChange={(v) => updateSetting(['editor', 'autoSave'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={HelpCircle}
                    label="Show Keyboard Hints"
                    description="Display keyboard shortcuts in the editor"
                  >
                    <ToggleSwitch
                      value={settings.keyboard.showHints}
                      onChange={(v) => updateSetting(['keyboard', 'showHints'], v)}
                    />
                  </SettingRow>

                  <div className="pt-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Default Language</h3>
                    <select className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white hover:border-slate-600 transition-colors">
                      <option>English (US)</option>
                      <option>English (UK)</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'notifications' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">Notification Preferences</h2>

                  <SettingRow
                    icon={Bell}
                    label="Email Notifications"
                    description="Get updates about new features and tips"
                  >
                    <ToggleSwitch
                      value={settings.notifications.email}
                      onChange={(v) => updateSetting(['notifications', 'email'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Bell}
                    label="Push Notifications"
                    description="Receive browser notifications"
                  >
                    <ToggleSwitch
                      value={settings.notifications.push}
                      onChange={(v) => updateSetting(['notifications', 'push'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Volume2}
                    label="Sound Notifications"
                    description="Play sounds for important events"
                  >
                    <ToggleSwitch
                      value={settings.notifications.sound}
                      onChange={(v) => updateSetting(['notifications', 'sound'], v)}
                    />
                  </SettingRow>

                  <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-300">
                      💡 <span className="font-medium">Tip:</span> Disable sound notifications to focus on editing without interruptions.
                    </p>
                  </div>
                </div>
              )}

              {/* Editor Settings */}
              {activeTab === 'editor' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">Editor Preferences</h2>

                  <SettingRow
                    icon={Zap}
                    label="Grid Snap"
                    description="Automatically snap elements to grid"
                  >
                    <ToggleSwitch
                      value={settings.editor.gridSnap}
                      onChange={(v) => updateSetting(['editor', 'gridSnap'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Eye}
                    label="Show Rulers"
                    description="Display ruler guides for precise positioning"
                  >
                    <ToggleSwitch
                      value={settings.editor.showRulers}
                      onChange={(v) => updateSetting(['editor', 'showRulers'], v)}
                    />
                  </SettingRow>

                  <div className="pt-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Default Thumbnail Quality</h3>
                    <div className="space-y-2">
                      {['high', 'medium', 'low'].map((quality) => (
                        <label key={quality} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="quality"
                            value={quality}
                            checked={settings.editor.defaultQuality === quality}
                            onChange={(e) => updateSetting(['editor', 'defaultQuality'], e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium capitalize">{quality} (
                            {quality === 'high' ? '2K' : quality === 'medium' ? '1080p' : '720p'}
                            )</span>
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
                    icon={Eye}
                    label="Public Profile"
                    description="Make your profile visible to other users"
                  >
                    <ToggleSwitch
                      value={settings.privacy.publicProfile}
                      onChange={(v) => updateSetting(['privacy', 'publicProfile'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Lock}
                    label="Share Analytics"
                    description="Help improve TubeFlow with usage analytics"
                  >
                    <ToggleSwitch
                      value={settings.privacy.shareAnalytics}
                      onChange={(v) => updateSetting(['privacy', 'shareAnalytics'], v)}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={FileText}
                    label="Allow Cookies"
                    description="Accept cookies for better experience"
                  >
                    <ToggleSwitch
                      value={settings.privacy.allowCookies}
                      onChange={(v) => updateSetting(['privacy', 'allowCookies'], v)}
                    />
                  </SettingRow>

                  <div className="mt-8 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
                    <h3 className="font-semibold text-white mb-3">Sensitive Information</h3>
                    <div className="space-y-2">
                      <button className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-left">
                        <span className="text-sm">Change Password</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => {
                          setTempApiKeys(apiKeys);
                          setShowAPIModal(true);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-left"
                      >
                        <span className="text-sm">API Keys</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                      <button className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-left">
                        <span className="text-sm">Connected Accounts</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Settings */}
              {activeTab === 'account' && (
                <div>
                  <h2 className="text-xl font-bold mb-6 text-white">Account</h2>

                  <div className="bg-slate-800/50 rounded-lg p-6 mb-6 border border-slate-700">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Signed in as</p>
                        <p className="text-lg font-semibold text-white">user@example.com</p>
                      </div>
                    </div>
                  </div>

                  <SettingRow
                    icon={Lock}
                    label="Change Password"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </SettingRow>

                  <SettingRow
                    icon={Download}
                    label="Download Your Data"
                    description="Export all your settings and projects"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </SettingRow>

                  <SettingRow
                    icon={FileText}
                    label="Terms and Policies"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </SettingRow>

                  <div className="mt-8 pt-8 border-t border-slate-700">
                    <button className="w-full px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-semibold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>

                  <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700 text-center">
                    <p className="text-xs text-slate-400">
                      App Version: 1.2.0 • Built with ❤️ for content creators
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
    </div>
  );
};

export default SettingsPage;
