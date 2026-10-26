import { getApiKeyStorageKey } from './keys';

export type StorageMode = 'local' | 'session' | 'memory';

// 記憶體儲存映射（適用於 memory 模式，重整或關閉分頁即清空）
const memoryKeyStore = new Map<string, string>();

const STORAGE_MODE_KEY = 'mapcraft.storage_mode';

/**
 * 取得當前設定的儲存模式（預設為 local）
 */
export function getStorageMode(): StorageMode {
  if (typeof window === 'undefined') return 'local';
  try {
    const mode = localStorage.getItem(STORAGE_MODE_KEY);
    if (mode === 'local' || mode === 'session' || mode === 'memory') {
      return mode;
    }
  } catch {
    // 忽略 localStorage 受限情況
  }
  return 'local';
}

/**
 * 設定全域金鑰儲存模式
 */
export function setStorageMode(mode: StorageMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    // 忽略受限環境
  }
}

/**
 * 讀取特定供應商的 API 金鑰
 * 依據當前儲存模式從對應位置讀取
 */
export function getStoredApiKey(
  providerId: string,
  mode: StorageMode = getStorageMode()
): string {
  const keyName = getApiKeyStorageKey(providerId);

  if (mode === 'memory') {
    return memoryKeyStore.get(keyName) || '';
  }

  if (typeof window === 'undefined') return '';

  try {
    if (mode === 'session') {
      return sessionStorage.getItem(keyName) || '';
    }
    return localStorage.getItem(keyName) || '';
  } catch {
    return '';
  }
}

/**
 * 儲存特定供應商的 API 金鑰
 */
export function setStoredApiKey(
  providerId: string,
  apiKey: string,
  mode: StorageMode = getStorageMode()
): void {
  const keyName = getApiKeyStorageKey(providerId);
  const trimmed = apiKey.trim();

  // 清除其他模式下的舊殘留，避免跨模式洩漏
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(keyName);
      sessionStorage.removeItem(keyName);
    } catch {
      // ignore
    }
  }
  memoryKeyStore.delete(keyName);

  if (!trimmed) {
    return;
  }

  if (mode === 'memory') {
    memoryKeyStore.set(keyName, trimmed);
    return;
  }

  if (typeof window === 'undefined') return;

  try {
    if (mode === 'session') {
      sessionStorage.setItem(keyName, trimmed);
    } else {
      localStorage.setItem(keyName, trimmed);
    }
  } catch {
    // 若 localStorage 寫入失敗則回退到記憶體儲存
    memoryKeyStore.set(keyName, trimmed);
  }
}

/**
 * 清除特定供應商的金鑰
 */
export function clearStoredApiKey(providerId: string): void {
  const keyName = getApiKeyStorageKey(providerId);
  memoryKeyStore.delete(keyName);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(keyName);
      sessionStorage.removeItem(keyName);
    } catch {
      // ignore
    }
  }
}
