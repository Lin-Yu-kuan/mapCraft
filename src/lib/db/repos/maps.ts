import { db } from '../db';
import type { LearningMap } from '@/domain/types';
import { cloudSyncManager } from '@/lib/cloud/syncManager';

export const mapsRepo = {
  async getAll(): Promise<LearningMap[]> {
    return db.maps.orderBy('updatedAt').reverse().toArray();
  },

  async getById(id: string): Promise<LearningMap | undefined> {
    return db.maps.get(id);
  },

  async save(map: LearningMap): Promise<string> {
    await db.maps.put(map);
    void cloudSyncManager.notifyLocalMutation();
    return map.id;
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.maps, db.progress, db.lessons, async () => {
      await db.maps.delete(id);
      await db.progress.where('mapId').equals(id).delete();
      await db.lessons.where('mapId').equals(id).delete();
    });
    void cloudSyncManager.notifyLocalMutation({ deletedMapId: id });
  },

  async updateTitle(id: string, title: string): Promise<void> {
    const map = await db.maps.get(id);
    if (map) {
      map.title = title;
      map.updatedAt = Date.now();
      await db.maps.put(map);
      void cloudSyncManager.notifyLocalMutation();
    }
  },
};
