import { db } from '../db';

export interface CleanupResult {
  cleanedProgress: number;
  cleanedLessons: number;
}

/**
 * SPEC §4.3 & AC-05：孤兒資料自動清理
 * 刪除 progress 和 lessons 表中 mapId 已不存在於 maps 表的紀錄。
 * 應在應用程式啟動時執行一次。
 */
export async function orphanCleanup(): Promise<CleanupResult> {
  return db.transaction('rw', db.maps, db.progress, db.lessons, async () => {
    // 取得所有存在的 map id
    const validMapIds = new Set(await db.maps.toCollection().primaryKeys());

    // 檢查孤兒 progress
    const allProgress = await db.progress.toArray();
    const orphanProgressKeys = allProgress
      .filter((p) => !validMapIds.has(p.mapId))
      .map((p) => [p.mapId, p.nodeId] as [string, string]);

    if (orphanProgressKeys.length > 0) {
      await db.progress.bulkDelete(orphanProgressKeys);
    }

    // 檢查孤兒 lessons
    const allLessons = await db.lessons.toArray();
    const orphanLessonKeys = allLessons
      .filter((l) => !validMapIds.has(l.mapId))
      .map((l) => [l.mapId, l.nodeId] as [string, string]);

    if (orphanLessonKeys.length > 0) {
      await db.lessons.bulkDelete(orphanLessonKeys);
    }

    return {
      cleanedProgress: orphanProgressKeys.length,
      cleanedLessons: orphanLessonKeys.length,
    };
  });
}
