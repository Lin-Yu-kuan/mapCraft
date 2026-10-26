import { db } from '../db';
import { STORAGE_SETTINGS_KEY } from '@/lib/storage/keys';

export interface AppSettings {
  uiLanguage: 'zh-TW' | 'zh-CN' | 'en';
  theme: 'light' | 'dark' | 'system';
  lastProviderId?: string;
  lastMapModelId?: string;
  lastLessonModelId?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  uiLanguage: 'zh-TW',
  theme: 'system',
};

export const settingsRepo = {
  async getSettings(): Promise<AppSettings> {
    const record = await db.kv.get(STORAGE_SETTINGS_KEY);
    if (!record || typeof record.value !== 'object' || record.value === null) {
      return DEFAULT_SETTINGS;
    }
    return {
      ...DEFAULT_SETTINGS,
      ...(record.value as Partial<AppSettings>),
    };
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    await db.kv.put({
      key: STORAGE_SETTINGS_KEY,
      value: {
        ...current,
        ...settings,
      },
    });
  },
};
