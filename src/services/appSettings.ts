export interface AppSettings {
  general: {
    darkMode: boolean;
    autoSave: boolean;
    showHints: boolean;
  };
  notifications: {
    processingComplete: boolean;
    email: boolean;
    sound: boolean;
  };
  ai: {
    autoCopy: boolean;
    showWordCount: boolean;
    outputDetail: 'concise' | 'standard' | 'detailed';
    thumbnailAssistantProvider: 'groq' | 'gemini';
  };
  privacy: {
    shareAnalytics: boolean;
    storeHistory: boolean;
  };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: { darkMode: true, autoSave: true, showHints: true },
  notifications: { processingComplete: true, email: false, sound: true },
  ai: { autoCopy: false, showWordCount: true, outputDetail: 'standard', thumbnailAssistantProvider: 'groq' },
  privacy: { shareAnalytics: true, storeHistory: true },
};

export function normalizeAppSettings(value: unknown): AppSettings {
  const parsed = (value && typeof value === 'object' ? value : {}) as Partial<AppSettings>;

  return {
    general: { ...DEFAULT_APP_SETTINGS.general, ...parsed.general },
    notifications: { ...DEFAULT_APP_SETTINGS.notifications, ...parsed.notifications },
    ai: { ...DEFAULT_APP_SETTINGS.ai, ...parsed.ai },
    privacy: { ...DEFAULT_APP_SETTINGS.privacy, ...parsed.privacy },
  };
}