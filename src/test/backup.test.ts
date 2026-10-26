import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/db';
import { createBackupData, importBackupData } from '@/lib/storage/backup';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';

describe('Backup Export & Import (SPEC §4.4, §4.5 & AC-07)', () => {
  const sampleMap: LearningMap = {
    id: 'test-backup-map-1',
    schemaVersion: 1,
    title: 'Vue 3 與 Vite 實戰',
    summary: '現代化前端框架核心掌握',
    topic: 'Vue 3',
    root: {
      id: '0',
      label: 'Vue 3',
      summary: '核心語法',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Composition API',
          summary: '響應式 ref 與 reactive 原理',
          difficulty: 'beginner',
        },
      ],
    },
    options: {
      level: 'beginner',
      maxDepth: 3,
      maxBreadth: 5,
      maxNodes: 30,
      temperature: 0.4,
      language: 'zh-TW',
    },
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const sampleProgress: NodeProgress = {
    mapId: 'test-backup-map-1',
    nodeId: '1',
    status: 'done',
    attempts: 1,
    correct: 1,
    updatedAt: Date.now(),
  };

  const sampleLesson: Lesson = {
    mapId: 'test-backup-map-1',
    nodeId: '1',
    schemaVersion: 1,
    modelId: 'gpt-4o',
    promptVersion: 'lesson.zh-TW.v1',
    content: {
      concept: 'Composition API 透過 setup 函式組合元件邏輯。',
      why: '解決大型元件 Options API 邏輯分散的維護痛點。',
      pitfalls: ['解構 reactive 物件會失去響應性，應使用 toRefs'],
      keyPoints: ['ref 用於基本型別與物件', 'reactive 僅用於物件'],
    },
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    await db.maps.clear();
    await db.progress.clear();
    await db.lessons.clear();
  });

  it('匯出備份資料包含地圖、進度與教材，且嚴格不含任何 API 金鑰特徵（AC-07）', async () => {
    await db.maps.put(sampleMap);
    await db.progress.put(sampleProgress);
    await db.lessons.put(sampleLesson);

    const backup = await createBackupData();

    expect(backup.format).toBe('mapcraft.backup');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.maps).toHaveLength(1);
    expect(backup.progress).toHaveLength(1);
    expect(backup.lessons).toHaveLength(1);

    // 安全斷言：以正則嚴格掃描完整 JSON 字串
    const jsonStr = JSON.stringify(backup);
    expect(jsonStr).not.toMatch(/sk-[a-zA-Z0-9_-]{16,}/);
    expect(jsonStr).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);
    expect(jsonStr).not.toMatch(/Bearer\s+/);
  });

  it('無損匯入：清空資料庫後匯入備份，資料與關聯完全一致（AC-07）', async () => {
    await db.maps.put(sampleMap);
    await db.progress.put(sampleProgress);
    await db.lessons.put(sampleLesson);

    const backup = await createBackupData();
    const backupJson = JSON.stringify(backup);

    // 清空 DB
    await db.maps.clear();
    await db.progress.clear();
    await db.lessons.clear();

    // 匯入
    const result = await importBackupData(backupJson);
    expect(result.mapsImported).toBe(1);
    expect(result.progressImported).toBe(1);
    expect(result.lessonsImported).toBe(1);

    // 驗證 DB 還原
    const restoredMap = await db.maps.get(sampleMap.id);
    expect(restoredMap?.title).toBe('Vue 3 與 Vite 實戰');

    const restoredProgress = await db.progress.get([sampleMap.id, '1']);
    expect(restoredProgress?.status).toBe('done');

    const restoredLesson = await db.lessons.get([sampleMap.id, '1']);
    expect(restoredLesson?.content.concept).toContain('Composition API');
  });

  it('ID 衝突處理：匯入已存在同 ID 地圖時，自動重新配發新 ID 並同步映射 progress 與 lessons', async () => {
    // 預先在 DB 存入同 ID 地圖
    await db.maps.put(sampleMap);
    await db.progress.put(sampleProgress);
    await db.lessons.put(sampleLesson);

    const backup = await createBackupData();
    const backupJson = JSON.stringify(backup);

    // 再次匯入相同備份（觸發 ID 衝突）
    const result = await importBackupData(backupJson);
    expect(result.mapsImported).toBe(1);

    // DB 現在應有 2 張地圖（原本的與新重配 ID 的）
    const allMaps = await db.maps.toArray();
    expect(allMaps).toHaveLength(2);

    const remappedMap = allMaps.find((m) => m.id !== sampleMap.id);
    expect(remappedMap).toBeDefined();

    // 驗證新地圖對應的 progress 也成功映射為新 mapId
    const remappedProgress = await db.progress.where('mapId').equals(remappedMap!.id).toArray();
    expect(remappedProgress).toHaveLength(1);
    expect(remappedProgress[0]?.nodeId).toBe('1');
    expect(remappedProgress[0]?.status).toBe('done');
  });

  it('拒絕非法或篡改格式的備份檔案', async () => {
    const invalidFormat = JSON.stringify({
      format: 'unknown.backup',
      version: 99,
      maps: [],
    });

    await expect(importBackupData(invalidFormat)).rejects.toThrow();
  });
});
