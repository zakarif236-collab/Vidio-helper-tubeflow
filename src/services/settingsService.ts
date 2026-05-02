import {
  readUserScopedStorageValue,
  removeUserScopedStorageValue,
  writeUserScopedStorageValue,
} from './browserStorage';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
} from './appSettings';
import { getUserAppSettings, saveUserAppSettings } from './userService';
import { getUserScopedDownloadName } from './userPaths';

export type { AppSettings } from './appSettings';

const LEGACY_SETTINGS_KEY = 'tubeflow_settings';

function logSettingsServiceError(action: string, error: unknown): void {
  console.warn(`[settingsService] Failed to ${action}.`, error);
}

function readLegacyLocalSettings(uid?: string): AppSettings | null {
  try {
    const saved = readUserScopedStorageValue(LEGACY_SETTINGS_KEY, uid);
    if (!saved) {
      return null;
    }

    return normalizeAppSettings(JSON.parse(saved));
  } catch {
    return null;
  }
}

export async function loadSettings(uid?: string): Promise<AppSettings> {
  if (!uid) {
    return DEFAULT_APP_SETTINGS;
  }

  try {
    const remote = await getUserAppSettings(uid);
    if (remote) {
      return normalizeAppSettings(remote);
    }
  } catch (error) {
    logSettingsServiceError('load remote settings', error);
  }

  const migratedLocalSettings = readLegacyLocalSettings(uid);
  if (migratedLocalSettings) {
    try {
      await saveUserAppSettings(uid, migratedLocalSettings);
      removeUserScopedStorageValue(LEGACY_SETTINGS_KEY, uid);
    } catch (error) {
      logSettingsServiceError('migrate local settings to Firestore', error);
    }

    return migratedLocalSettings;
  }

  return DEFAULT_APP_SETTINGS;
}

export async function persistSettings(settings: AppSettings, uid?: string): Promise<void> {
  if (!uid) {
    return;
  }

  const normalizedSettings = normalizeAppSettings(settings);

  try {
    await saveUserAppSettings(uid, normalizedSettings);
    removeUserScopedStorageValue(LEGACY_SETTINGS_KEY, uid);
  } catch (error) {
    logSettingsServiceError('save settings to Firestore', error);
    writeUserScopedStorageValue(
      LEGACY_SETTINGS_KEY,
      JSON.stringify(normalizedSettings),
      uid,
    );
  }
}

export async function exportUserData(uid?: string): Promise<void> {
  const settings = await loadSettings(uid);
  const data = {
    settings,
    apiKeys: {
      gemini: readUserScopedStorageValue('app_gemini_key', uid) ? '[SET]' : '[NOT SET]',
      youtube: readUserScopedStorageValue('app_youtube_key', uid) ? '[SET]' : '[NOT SET]',
    },
    storagePolicy: {
      cold: 'Settings are synced to your Firestore user profile.',
      hot: 'Analytics counters, password marker, and API keys remain local to this browser.',
    },
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getUserScopedDownloadName('tubeflow-export', 'json', uid);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
