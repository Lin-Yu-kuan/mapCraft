import { db } from '../db';
import type { Lesson } from '@/domain/types';
import { cloudSyncManager } from '@/lib/cloud/syncManager';

export const lessonsRepo = {
  async get(mapId: string, nodeId: string): Promise<Lesson | undefined> {
    return db.lessons.get([mapId, nodeId]);
  },

  async getByMapId(mapId: string): Promise<Lesson[]> {
    return db.lessons.where('mapId').equals(mapId).toArray();
  },

  async save(lesson: Lesson): Promise<void> {
    await db.lessons.put(lesson);
    void cloudSyncManager.notifyLocalMutation();
  },

  async delete(mapId: string, nodeId: string): Promise<void> {
    await db.lessons.delete([mapId, nodeId]);
    void cloudSyncManager.notifyLocalMutation();
  },

  async clearAll(): Promise<void> {
    await db.lessons.clear();
    void cloudSyncManager.notifyLocalMutation();
  },

  async clearByMapId(mapId: string): Promise<number> {
    const count = await db.lessons.where('mapId').equals(mapId).delete();
    void cloudSyncManager.notifyLocalMutation();
    return count;
  },
};
