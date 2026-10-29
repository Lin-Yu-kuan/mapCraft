import { db } from '../db';
import { STORAGE_SETTINGS_KEY } from '@/lib/storage/keys';

export interface AppSettings {
  uiLanguage: 'zh-TW' | 'zh-CN' | 'en';
  theme: 'light' | 'dark' | 'system';
  lastProviderId?: string;
  lastMapModelId?: string;
  lastLessonModelId?: string;
  /** Google OAuth 2.0 Client ID（非敏感公開識別碼） */
  gdriveClientId?: string;
  /** 是否啟用有網路時自動背景同步至 Google Drive */
  gdriveAutoSync?: boolean;
  /** Google Drive MapCraft 專屬資料夾 ID */
  gdriveFolderId?: string;
  /** Google Drive 雲端同步檔案 ID */
  gdriveSyncFileId?: string;
  /** 最後一次成功與雲端同步的時間戳記 (ms) */
  lastSyncedAt?: number;
  /** 本地刪除的地圖墓碑紀錄（mapId -> deletedAt），用於多裝置同步刪除 */
  deletedMapIds?: Record<string, number>;
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
