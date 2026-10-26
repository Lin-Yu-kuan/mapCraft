import { describe, it, expect, beforeEach } from 'vitest';
import { db, mapsRepo, progressRepo, lessonsRepo, orphanCleanup } from '@/lib/db';
import { DB_NAME, STORAGE_SETTINGS_KEY } from '@/lib/storage/keys';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';

describe('Dexie Database & Repositories', () => {
  beforeEach(async () => {
    await db.maps.clear();
    await db.progress.clear();
    await db.lessons.clear();
    await db.kv.clear();
  });

  it('uses the frozen database name', () => {
    expect(db.name).toBe(DB_NAME);
    expect(db.name).toBe('mapcraft');
    expect(STORAGE_SETTINGS_KEY).toBe('mapcraft.settings.v1');
  });

  it('can create, retrieve, and delete maps with cascading cleanup', () => {
    const testMap: LearningMap = {
      id: 'map_1',
      schemaVersion: 1,
      title: 'Spring Boot 入門',
      summary: '從零開始學習 Spring Boot',
      topic: 'Spring Boot',
      root: {
        id: '0',
        label: 'Spring Boot',
        summary: 'Spring Boot 學習地圖',
        difficulty: 'beginner',
        children: [
          {
            id: '1',
            label: '基礎概念',
            summary: '了解核心原理',
            difficulty: 'beginner',
          },
        ],
      },
      options: {
        maxDepth: 3,
        maxBreadth: 5,
        maxNodes: 30,
        temperature: 0.4,
        level: 'beginner',
        language: 'zh-TW',
      },
      providerId: 'openai',
      modelId: 'gpt-4o',
      createdAt: 1000,
      updatedAt: 2000,
    };

    return (async () => {
      // 儲存地圖
      await mapsRepo.save(testMap);
      const retrieved = await mapsRepo.getById('map_1');
      expect(retrieved?.title).toBe('Spring Boot 入門');

      // 儲存相關進度與教材
      const progress: NodeProgress = {
        mapId: 'map_1',
        nodeId: '1',
        status: 'done',
        attempts: 1,
        correct: 1,
        updatedAt: 3000,
      };
      await progressRepo.save(progress);

      const lesson: Lesson = {
        mapId: 'map_1',
        nodeId: '1',
        schemaVersion: 1,
        modelId: 'gpt-4o',
        promptVersion: 'lesson.zh-TW.v1',
        createdAt: 3000,
        content: {
          concept: 'Spring Boot 是基於 Spring 的快速開發框架',
          why: '簡化配置',
          pitfalls: ['忘記加註解'],
          keyPoints: ['自動配置'],
        },
      };
      await lessonsRepo.save(lesson);

      expect((await progressRepo.getByMapId('map_1')).length).toBe(1);
      expect((await lessonsRepo.getByMapId('map_1')).length).toBe(1);

      // 刪除地圖應一併清除關聯資料
      await mapsRepo.delete('map_1');
      expect(await mapsRepo.getById('map_1')).toBeUndefined();
      expect((await progressRepo.getByMapId('map_1')).length).toBe(0);
      expect((await lessonsRepo.getByMapId('map_1')).length).toBe(0);
    })();
  });

  it('orphanCleanup removes orphan progress and lessons for deleted maps', async () => {
    // 故意注入沒有對應 map 的進度與教材
    await progressRepo.save({
      mapId: 'deleted_map',
      nodeId: '1',
      status: 'learning',
      attempts: 0,
      correct: 0,
      updatedAt: Date.now(),
    });

    await lessonsRepo.save({
      mapId: 'deleted_map',
      nodeId: '1',
      schemaVersion: 1,
      modelId: 'test-model',
      promptVersion: 'v1',
      createdAt: Date.now(),
      content: {
        concept: '孤兒教材',
        why: '測試孤兒清理',
        pitfalls: [],
        keyPoints: [],
      },
    });

    const result = await orphanCleanup();
    expect(result.cleanedProgress).toBe(1);
    expect(result.cleanedLessons).toBe(1);

    expect(await progressRepo.getByMapId('deleted_map')).toEqual([]);
    expect(await lessonsRepo.getByMapId('deleted_map')).toEqual([]);
  });
});
