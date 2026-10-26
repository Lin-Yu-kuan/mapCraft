import { db } from '../db/db';
import { settingsRepo } from '../db/repos/settings';
import { BACKUP_FORMAT, BACKUP_EXTENSION } from './keys';
import { BackupSchema, type BackupData } from '@/domain/schemas';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';

/**
 * 金鑰特徵掃描正則（SPEC AC-07 安全斷言）
 * 匯出檔絕不允許存在任何真實或測試金鑰特徵
 */
const SENSITIVE_KEY_PATTERN = /(?:sk-[a-zA-Z0-9_-]{16,}|AIza[0-9A-Za-z_-]{35}|Bearer\s+[a-zA-Z0-9_.-]+)/;

/**
 * 匯出備份資料（可選擇匯出全部或單一地圖）
 * @throws Error 若檢測到任何可能洩漏的金鑰特徵
 */
export async function createBackupData(targetMapId?: string): Promise<BackupData> {
  let maps: LearningMap[];
  let progress: NodeProgress[];
  let lessons: Lesson[];

  if (targetMapId) {
    const singleMap = await db.maps.get(targetMapId);
    maps = singleMap ? [singleMap] : [];
    progress = await db.progress.where('mapId').equals(targetMapId).toArray();
    lessons = await db.lessons.where('mapId').equals(targetMapId).toArray();
  } else {
    maps = await db.maps.toArray();
    progress = await db.progress.toArray();
    lessons = await db.lessons.toArray();
  }

  const settings = await settingsRepo.getSettings();

  const backup: BackupData = {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    exportedAt: Date.now(),
    app: {
      name: 'MapCraft',
      version: '0.1.0',
    },
    maps: maps as unknown as Record<string, unknown>[],
    progress: progress as unknown as Record<string, unknown>[],
    lessons: lessons as unknown as Record<string, unknown>[],
    settings: {
      uiLanguage: settings.uiLanguage,
      theme: settings.theme,
    },
  };

  // 安全檢查：驗證匯出 JSON 中絕不包含任何金鑰特徵
  const serialized = JSON.stringify(backup);
  if (SENSITIVE_KEY_PATTERN.test(serialized)) {
    throw new Error('安全性違規：備份資料中偵測到潛在的金鑰字串，已強制阻斷匯出！');
  }

  return backup;
}

/**
 * 匯入備份資料（含 Zod 驗證、ID 衝突重分配與 Transaction 寫入）
 */
export async function importBackupData(
  jsonString: string
): Promise<{ mapsImported: number; progressImported: number; lessonsImported: number }> {
  // 1. JSON 解析與 Zod 驗證
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(jsonString);
  } catch {
    throw new Error('匯入失敗：檔案不是合法的 JSON 格式。');
  }

  const validatedBackup = BackupSchema.parse(rawParsed);

  // 2. 衝突檢測與 ID 映射
  const existingMaps = await db.maps.toArray();
  const existingMapIds = new Set(existingMaps.map((m) => m.id));

  const idMap = new Map<string, string>(); // 舊 ID -> 新 ID
  const mapsToInsert: LearningMap[] = [];

  for (const rawMap of validatedBackup.maps) {
    const map = rawMap as unknown as LearningMap;
    if (existingMapIds.has(map.id)) {
      // 發生 ID 衝突：重新生成唯一 ID
      const newMapId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `map_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      idMap.set(map.id, newMapId);
      mapsToInsert.push({
        ...map,
        id: newMapId,
        updatedAt: Date.now(),
      });
    } else {
      mapsToInsert.push(map);
    }
  }

  // 映射 progress
  const progressToInsert: NodeProgress[] = (
    validatedBackup.progress as unknown as NodeProgress[]
  ).map((p) => {
    const nextMapId = idMap.get(p.mapId) || p.mapId;
    return {
      ...p,
      mapId: nextMapId,
    };
  });

  // 映射 lessons
  const lessonsToInsert: Lesson[] = (
    validatedBackup.lessons as unknown as Lesson[]
  ).map((l) => {
    const nextMapId = idMap.get(l.mapId) || l.mapId;
    return {
      ...l,
      mapId: nextMapId,
    };
  });

  // 3. 使用 Dexie Transaction 原子寫入
  await db.transaction('rw', db.maps, db.progress, db.lessons, async () => {
    if (mapsToInsert.length > 0) {
      await db.maps.bulkPut(mapsToInsert);
    }
    if (progressToInsert.length > 0) {
      await db.progress.bulkPut(progressToInsert);
    }
    if (lessonsToInsert.length > 0) {
      await db.lessons.bulkPut(lessonsToInsert);
    }
  });

  return {
    mapsImported: mapsToInsert.length,
    progressImported: progressToInsert.length,
    lessonsImported: lessonsToInsert.length,
  };
}

/**
 * 觸發瀏覽器下載 Blob 檔案
 */
export function downloadBlob(filename: string, content: string, mimeType: string): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 下載 .mapcraft.json 備份檔案
 */
export function downloadBackupFile(backup: BackupData, customPrefix = 'mapcraft_backup'): void {
  const dateStr = new Date(backup.exportedAt).toISOString().split('T')[0];
  const filename = `${customPrefix}_${dateStr}${BACKUP_EXTENSION}`;
  const content = JSON.stringify(backup, null, 2);
  downloadBlob(filename, content, 'application/json');
}
