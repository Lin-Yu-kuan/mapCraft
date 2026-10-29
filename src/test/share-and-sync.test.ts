import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encodeSharePayload,
  decodeSharePayload,
  buildShareUrl,
} from '@/domain/share';
import { mergeSyncData } from '@/domain/sync';
import { db } from '@/lib/db/db';
import { saveSharedPayloadToLocal } from '@/lib/storage/backup';
import {
  setGoogleDriveToken,
  clearGoogleDriveToken,
  publishMapToGoogleDrive,
} from '@/lib/cloud/googleDrive';
import { cloudSyncManager } from '@/lib/cloud/syncManager';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';

function createMockMap(id: string, title: string, updatedAt: number): LearningMap {
  return {
    id,
    schemaVersion: 1,
    title,
    summary: '這是一張測試用的學習地圖摘要說明',
    topic: 'TypeScript',
    root: {
      id: '0',
      label: title,
      summary: '根節點摘要說明文字',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: '基礎型別系統',
          summary: '掌握基本型別與推論規則',
          difficulty: 'beginner',
          estMinutes: 20,
        },
        {
          id: '2',
          label: '泛型與進階工具型別',
          summary: '理解泛型約束與條件型別',
          difficulty: 'intermediate',
          estMinutes: 35,
        },
      ],
    },
    options: {
      maxDepth: 3,
      maxBreadth: 4,
      maxNodes: 20,
      temperature: 0.4,
      level: 'beginner',
      language: 'zh-TW',
    },
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    createdAt: 1700000000000,
    updatedAt,
  };
}

describe('Domain: URL Direct Share (encodeSharePayload / decodeSharePayload)', () => {
  it('成功編碼並解碼含進度與小型教材的學習地圖', async () => {
    const map = createMockMap('map_1', 'TypeScript 實戰攻略', 1700000005000);
    const progress: NodeProgress[] = [
      {
        mapId: 'map_1',
        nodeId: '1',
        status: 'done',
        attempts: 1,
        correct: 1,
        updatedAt: 1700000006000,
      },
    ];
    const lessons: Lesson[] = [
      {
        mapId: 'map_1',
        nodeId: '1',
        schemaVersion: 1,
        modelId: 'gpt-4o-mini',
        promptVersion: 'lesson.zh-TW.v2',
        content: {
          markdown: '### 基礎型別\n\nTypeScript 提供了靜態型別檢查機制，能於編譯期攔截錯誤。',
          quiz: {
            question: '下列何者為 TypeScript 的基本型別？',
            options: ['string', 'int32', 'varchar', 'char'],
            answerIndex: 0,
            explanation: 'string 是 TypeScript 的核心基本型別之一。',
          },
        },
        createdAt: 1700000006000,
      },
    ];

    const encodedRes = await encodeSharePayload(map, progress, lessons);
    expect(encodedRes.encoded.length).toBeGreaterThan(10);
    expect(encodedRes.includesLessons).toBe(true);

    const decoded = await decodeSharePayload(encodedRes.encoded);
    expect(decoded.map.id).toBe('map_1');
    expect(decoded.map.title).toBe('TypeScript 實戰攻略');
    expect(decoded.progress).toHaveLength(1);
    expect(decoded.lessons).toHaveLength(1);
    expect(decoded.lessons?.[0]?.content.markdown).toContain('靜態型別檢查');
  });

  it('當教材容量過大超過網址長度上限時，自動降級為僅分享地圖骨架與進度', async () => {
    const map = createMockMap('map_large', '大型地圖測試', 1700000005000);
    // 構造超長隨機教材使其超過 14000 字元
    const hugeLessons: Lesson[] = Array.from({ length: 25 }, (_, idx) => ({
      mapId: 'map_large',
      nodeId: String(idx + 1),
      schemaVersion: 1,
      modelId: 'gpt-4o-mini',
      promptVersion: 'lesson.zh-TW.v2',
      content: {
        markdown: Array.from(
          { length: 400 },
          (_, j) => `Node_${idx}_Line_${j}_${Math.sin(idx * 1000 + j).toString(36)}`
        ).join(' '),
      },
      createdAt: 1700000006000,
    }));

    const encodedRes = await encodeSharePayload(map, [], hugeLessons);
    expect(encodedRes.includesLessons).toBe(false);

    const decoded = await decodeSharePayload(encodedRes.encoded);
    expect(decoded.map.id).toBe('map_large');
    expect(decoded.lessons).toBeUndefined();
  });

  it('若資料中混入疑似 API Key 字串，強制拋出安全性錯誤阻斷分享', async () => {
    const leakedMap = createMockMap(
      'map_leak',
      'sk-proj-1234567890abcdefghijklmnop',
      1700000005000
    );
    await expect(encodeSharePayload(leakedMap)).rejects.toThrow(/安全性阻斷/);
  });

  it('buildShareUrl 正確組合 HashRouter 分享網址', () => {
    const url1 = buildShareUrl('https://lin-yu-kuan.github.io/mapCraft/#/map/123', {
      data: 'z.abc123',
    });
    expect(url1).toBe('https://lin-yu-kuan.github.io/mapCraft/#/share?data=z.abc123');

    const url2 = buildShareUrl('https://lin-yu-kuan.github.io/mapCraft', {
      gdrive: 'file_999',
    });
    expect(url2).toBe('https://lin-yu-kuan.github.io/mapCraft/#/share?gdrive=file_999');
  });
});

describe('Domain: Local-First Cloud Sync Merge (mergeSyncData)', () => {
  it('無衝突時合併本機與雲端各自新增的地圖，並依 updatedAt 排序', () => {
    const localMap = createMockMap('map_local', '本機新地圖', 2000);
    const remoteMap = createMockMap('map_remote', '雲端新地圖', 3000);

    const merged = mergeSyncData(
      { maps: [localMap], progress: [], lessons: [] },
      { maps: [remoteMap], progress: [], lessons: [] }
    );

    expect(merged.maps).toHaveLength(2);
    expect(merged.maps[0]?.id).toBe('map_remote');
    expect(merged.maps[1]?.id).toBe('map_local');
    expect(merged.stats.pushedMaps).toBe(1);
    expect(merged.stats.pulledMaps).toBe(1);
  });

  it('同 ID 地圖與進度衝突時，採用 Last-Write-Wins（最後修改時間優先）', () => {
    const olderMap = createMockMap('map_shared', '舊標題', 1000);
    const newerMap = createMockMap('map_shared', '雲端更新後的新標題', 5000);

    const localProgress: NodeProgress = {
      mapId: 'map_shared',
      nodeId: '1',
      status: 'done',
      attempts: 2,
      correct: 2,
      updatedAt: 6000, // 本機進度較新
    };
    const remoteProgress: NodeProgress = {
      mapId: 'map_shared',
      nodeId: '1',
      status: 'learning',
      attempts: 1,
      correct: 0,
      updatedAt: 3000, // 雲端進度較舊
    };

    const merged = mergeSyncData(
      { maps: [olderMap], progress: [localProgress], lessons: [] },
      { maps: [newerMap], progress: [remoteProgress], lessons: [] }
    );

    expect(merged.maps).toHaveLength(1);
    expect(merged.maps[0]?.title).toBe('雲端更新後的新標題');
    expect(merged.progress).toHaveLength(1);
    expect(merged.progress[0]?.status).toBe('done');
  });

  it('支援刪除墓碑（Deleted Tombstones），已在本機刪除的地圖不會從雲端復活', () => {
    const remoteMap = createMockMap('map_deleted', '待刪除地圖', 2000);

    const merged = mergeSyncData(
      {
        maps: [],
        progress: [],
        lessons: [],
        deletedMapIds: { map_deleted: 4000 }, // 在 t=4000 時被本機刪除
      },
      {
        maps: [remoteMap],
        progress: [
          {
            mapId: 'map_deleted',
            nodeId: '1',
            status: 'done',
            attempts: 1,
            correct: 1,
            updatedAt: 2000,
          },
        ],
        lessons: [],
      }
    );

    expect(merged.maps).toHaveLength(0);
    expect(merged.progress).toHaveLength(0);
    expect(merged.stats.deletedMaps).toBe(1);
    expect(merged.deletedMapIds.map_deleted).toBe(4000);
  });
});

describe('Integration: Local-First Save Shared Map & Google Drive Sync', () => {
  beforeEach(async () => {
    await db.maps.clear();
    await db.progress.clear();
    await db.lessons.clear();
    await db.kv.clear();
    clearGoogleDriveToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saveSharedPayloadToLocal 可將分享地圖與筆記存入本機 IndexedDB，若同 ID 已存在則分配新 ID', async () => {
    const sharedMap = createMockMap('map_shared_1', '分享來的 Rust 地圖', 1700000010000);
    const sharedLesson: Lesson = {
      mapId: 'map_shared_1',
      nodeId: '1',
      schemaVersion: 1,
      modelId: 'gpt-4o-mini',
      promptVersion: 'lesson.zh-TW.v2',
      content: {
        markdown: '### 所有權規則\n\n每個值在 Rust 中都有一個對應的所有者。',
      },
      createdAt: 1700000011000,
    };

    // 第一次儲存：保留原 ID
    const id1 = await saveSharedPayloadToLocal({
      v: 1,
      map: sharedMap,
      lessons: [sharedLesson],
    });
    expect(id1).toBe('map_shared_1');

    // 第二次儲存同 ID：自動產生新 ID 避免覆蓋
    const id2 = await saveSharedPayloadToLocal({
      v: 1,
      map: sharedMap,
      lessons: [sharedLesson],
    });
    expect(id2).not.toBe('map_shared_1');

    const allMaps = await db.maps.toArray();
    expect(allMaps).toHaveLength(2);
  });

  it('Google Drive 雙向同步（syncNow）與單張地圖雲端分享（publishMapToGoogleDrive）可正常運作', async () => {
    const localMap = createMockMap('map_local_drive', '準備同步到雲端的地圖', 5000);
    await db.maps.put(localMap);

    // 設定模擬的測試 token（非 sk-/AIza/ya29 真實格式，避免觸發備份內容正則，或測試真實 API 呼叫）
    setGoogleDriveToken('test_oauth_drive_token_123');

    const remoteMap = createMockMap('map_from_cloud', '從另一台電腦同步來的地圖', 8000);
    const remoteSyncPayload = {
      format: 'mapcraft.backup',
      schemaVersion: 1,
      exportedAt: 8000,
      app: { name: 'MapCraft', version: '0.1.0' },
      maps: [remoteMap],
      progress: [],
      lessons: [],
      settings: { uiLanguage: 'zh-TW', theme: 'system', deletedMapIds: {} },
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      const method = (init?.method || 'GET').toUpperCase();

      if (urlStr.includes('/drive/v3/files?') && method === 'GET') {
        const parsedUrl = new URL(urlStr);
        const q = parsedUrl.searchParams.get('q') || '';
        if (q.includes('application/vnd.google-apps.folder')) {
          return new Response(JSON.stringify({ files: [{ id: 'folder_mapcraft_1' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (q.includes('mapcraft_cloud_sync.mapcraft.json')) {
          return new Response(JSON.stringify({ files: [{ id: 'sync_file_1' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ files: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.includes('/drive/v3/files/sync_file_1?alt=media') && method === 'GET') {
        return new Response(JSON.stringify(remoteSyncPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.includes('/upload/drive/v3/files/sync_file_1') && method === 'PATCH') {
        return new Response(JSON.stringify({ id: 'sync_file_1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.includes('/upload/drive/v3/files?') && method === 'POST') {
        return new Response(JSON.stringify({ id: 'shared_file_999' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.includes('/drive/v3/files/shared_file_999/permissions') && method === 'POST') {
        return new Response(JSON.stringify({ id: 'anyoneWithLink' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ id: 'folder_mapcraft_1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // 1. 執行雙向同步：本機地圖與雲端地圖應合併為 2 張
    const syncOk = await cloudSyncManager.syncNow();
    expect(cloudSyncManager.getState().errorMessage).toBeUndefined();
    expect(syncOk).toBe(true);

    const mapsAfterSync = await db.maps.toArray();
    expect(mapsAfterSync).toHaveLength(2);
    expect(mapsAfterSync.map((m) => m.id).sort()).toEqual(
      ['map_from_cloud', 'map_local_drive'].sort()
    );

    // 2. 執行單張地圖 Google Drive 分享
    const shareRes = await publishMapToGoogleDrive('map_local_drive');
    expect(shareRes.fileId).toBe('shared_file_999');
    expect(shareRes.shareUrl).toContain('#/share?gdrive=shared_file_999');
  });
});
