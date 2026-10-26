/**
 * SPEC §4.5 識別字凍結表（Identifier Freeze）
 * 這些字串代表資料庫名稱與 Storage key，一旦寫入使用者瀏覽器就不可隨意變更。
 * 所有模組一律 import 此處定義的常數，嚴禁在其他檔案使用字面值（Magic String）。
 */

/** IndexedDB 資料庫名稱 */
export const DB_NAME = 'mapcraft';

/** 應用設定 storage key（不含金鑰） */
export const STORAGE_SETTINGS_KEY = 'mapcraft.settings.v1';

/** 金鑰 storage key 前綴（例：mapcraft.key.openai） */
export const KEY_PREFIX = 'mapcraft.key.';

/** 畫布節點展開收合狀態 key 前綴（例：mapcraft.collapsed.map_123） */
export const COLLAPSED_PREFIX = 'mapcraft.collapsed.';

/** 備份檔格式識別字 */
export const BACKUP_FORMAT = 'mapcraft.backup';

/** 備份副檔名 */
export const BACKUP_EXTENSION = '.mapcraft.json';

/** 生成指定 provider 的金鑰 key */
export function getApiKeyStorageKey(providerId: string): string {
  return `${KEY_PREFIX}${providerId}`;
}

/** 生成指定 mapId 的節點收合狀態 key */
export function getCollapsedStorageKey(mapId: string): string {
  return `${COLLAPSED_PREFIX}${mapId}`;
}
