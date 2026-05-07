import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Wrench } from 'lucide-react';
import {
  DEFAULT_MAINTENANCE_SETTINGS,
  subscribeToMaintenanceSettings,
  type MaintenanceSettings,
} from '../services/maintenanceService';

function formatLastUpdated(settings: MaintenanceSettings): string | null {
  if (settings.lastUpdatedAt) {
    return settings.lastUpdatedAt.toDate().toLocaleString();
  }

  return null;
}

function MaintenanceScreen({ settings }: { settings: MaintenanceSettings }) {
  const lastUpdated = formatLastUpdated(settings);

  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.12),transparent_35%),linear-gradient(180deg,#040404_0%,#101313_100%)]" />
      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/80 shadow-[0_24px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="border-b border-white/10 bg-white/[0.03] px-6 py-4 sm:px-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100">
              <Wrench className="h-4 w-4" />
              Maintenance Mode Active
            </div>
          </div>

          <div className="px-6 py-10 sm:px-8 sm:py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">TubeFlow Status</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {settings.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              {settings.subtitle}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Expected Return</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {settings.date || 'We will post an update here soon.'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Last Updated</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {lastUpdated || 'Waiting for first update timestamp.'}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-6 text-zinc-300">
              Change the Firestore document at <span className="font-mono text-zinc-100">config/maintenance</span> to control this page.
              Set <span className="font-mono text-zinc-100">isMaintenanceMode</span> to <span className="font-mono text-zinc-100">false</span> when the app should open normally again.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToMaintenanceSettings((nextSettings) => {
      setSettings(nextSettings);
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-zinc-300">
        <div className="text-sm tracking-[0.18em] uppercase">Checking system status…</div>
      </div>
    );
  }

  if (settings.isMaintenanceMode) {
    return <MaintenanceScreen settings={settings} />;
  }

  return <>{children}</>;
}