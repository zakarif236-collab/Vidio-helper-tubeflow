import {
  doc,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { MaintenanceConfigDocument } from '../types/firestore';

export interface MaintenanceSettings {
  isMaintenanceMode: boolean;
  title: string;
  subtitle: string;
  date: string;
  lastUpdatedAt: Timestamp | null;
}

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  isMaintenanceMode: false,
  title: 'Down for Maintenance',
  subtitle: 'We are making improvements. Please check back shortly.',
  date: '',
  lastUpdatedAt: null,
};

const maintenanceDocRef = doc(db, 'config', 'maintenance');

export function normalizeMaintenanceSettings(value: unknown): MaintenanceSettings {
  const parsed = (value && typeof value === 'object' ? value : {}) as MaintenanceConfigDocument;

  return {
    isMaintenanceMode: Boolean(parsed.isMaintenanceMode),
    title: typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : DEFAULT_MAINTENANCE_SETTINGS.title,
    subtitle: typeof parsed.subtitle === 'string' && parsed.subtitle.trim()
      ? parsed.subtitle.trim()
      : DEFAULT_MAINTENANCE_SETTINGS.subtitle,
    date: typeof parsed.date === 'string' ? parsed.date.trim() : '',
    lastUpdatedAt: parsed.lastUpdatedAt instanceof Timestamp ? parsed.lastUpdatedAt : null,
  };
}

export function subscribeToMaintenanceSettings(
  onValue: (settings: MaintenanceSettings) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    maintenanceDocRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onValue(DEFAULT_MAINTENANCE_SETTINGS);
        return;
      }

      onValue(normalizeMaintenanceSettings(snapshot.data()));
    },
    (error) => {
      console.warn('[maintenanceService] Failed to read maintenance config.', error);
      onValue(DEFAULT_MAINTENANCE_SETTINGS);
      onError?.(error);
    },
  );
}