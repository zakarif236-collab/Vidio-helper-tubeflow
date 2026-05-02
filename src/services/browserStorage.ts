const LOCAL_BROWSER_STORAGE_FALLBACK_OWNER = 'anonymous';

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getBrowserStorageOwner(uid?: string | null): string {
  const normalizedUid = uid?.trim();
  return normalizedUid || LOCAL_BROWSER_STORAGE_FALLBACK_OWNER;
}

export function getUserScopedStorageKey(key: string, uid?: string | null): string {
  return `${key}:${getBrowserStorageOwner(uid)}`;
}

export function getUserScopedIndexedDbName(databaseName: string, uid?: string | null): string {
  return `${databaseName}:${getBrowserStorageOwner(uid)}`;
}

export function readBrowserStorageValue(key: string): string | null {
  return getLocalStorage()?.getItem(key) ?? null;
}

export function writeBrowserStorageValue(key: string, value: string): void {
  getLocalStorage()?.setItem(key, value);
}

export function removeBrowserStorageValue(key: string): void {
  getLocalStorage()?.removeItem(key);
}

export function readUserScopedStorageValue(key: string, uid?: string | null): string | null {
  return readBrowserStorageValue(getUserScopedStorageKey(key, uid));
}

export function writeUserScopedStorageValue(key: string, value: string, uid?: string | null): void {
  writeBrowserStorageValue(getUserScopedStorageKey(key, uid), value);
}

export function removeUserScopedStorageValue(key: string, uid?: string | null): void {
  removeBrowserStorageValue(getUserScopedStorageKey(key, uid));
}