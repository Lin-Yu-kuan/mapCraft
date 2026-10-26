import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStorageMode,
  setStorageMode,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
} from '@/lib/storage/settings';
import { getApiKeyStorageKey } from '@/lib/storage/keys';

describe('Storage Settings (SPEC §2.2 FR-01 & §7.1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setStorageMode('local');
  });

  it('defaults to local storage mode', () => {
    expect(getStorageMode()).toBe('local');
  });

  it('switches between local, session, and memory modes', () => {
    setStorageMode('session');
    expect(getStorageMode()).toBe('session');

    setStorageMode('memory');
    expect(getStorageMode()).toBe('memory');
  });

  it('stores and retrieves apiKey in local mode using frozen key format', () => {
    const providerId = 'openai';
    const key = '  sk-test-1234567890abcdef  ';
    setStoredApiKey(providerId, key, 'local');

    // 自動 trim 去除空格
    expect(getStoredApiKey(providerId, 'local')).toBe('sk-test-1234567890abcdef');

    // 驗證儲存在 localStorage 中的 key 符合凍結規範 mapcraft.key.openai
    const frozenStorageKey = getApiKeyStorageKey('openai');
    expect(localStorage.getItem(frozenStorageKey)).toBe('sk-test-1234567890abcdef');
    expect(sessionStorage.getItem(frozenStorageKey)).toBeNull();
  });

  it('stores apiKey in sessionStorage when in session mode', () => {
    const providerId = 'anthropic';
    const key = 'sk-ant-test-999';
    setStoredApiKey(providerId, key, 'session');

    expect(getStoredApiKey(providerId, 'session')).toBe(key);
    const frozenStorageKey = getApiKeyStorageKey('anthropic');
    expect(sessionStorage.getItem(frozenStorageKey)).toBe(key);
    expect(localStorage.getItem(frozenStorageKey)).toBeNull();
  });

  it('stores apiKey purely in memory when in memory mode', () => {
    const providerId = 'google';
    const key = 'AIzaSyMemoryOnlySecret';
    setStoredApiKey(providerId, key, 'memory');

    expect(getStoredApiKey(providerId, 'memory')).toBe(key);
    const frozenStorageKey = getApiKeyStorageKey('google');
    // 不落入任何 Storage
    expect(localStorage.getItem(frozenStorageKey)).toBeNull();
    expect(sessionStorage.getItem(frozenStorageKey)).toBeNull();
  });

  it('clears stored api key', () => {
    setStoredApiKey('openai', 'sk-to-be-cleared', 'local');
    clearStoredApiKey('openai');
    expect(getStoredApiKey('openai', 'local')).toBe('');
  });
});
