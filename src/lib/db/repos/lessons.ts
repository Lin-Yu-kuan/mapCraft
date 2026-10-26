import { db } from '../db';
import type { Lesson } from '@/domain/types';

export const lessonsRepo = {
  async get(mapId: string, nodeId: string): Promise<Lesson | undefined> {
    return db.lessons.get([mapId, nodeId]);
  },

  async getByMapId(mapId: string): Promise<Lesson[]> {
    return db.lessons.where('mapId').equals(mapId).toArray();
  },

  async save(lesson: Lesson): Promise<void> {
    await db.lessons.put(lesson);
  },

  async delete(mapId: string, nodeId: string): Promise<void> {
    await db.lessons.delete([mapId, nodeId]);
  },

  async clearAll(): Promise<void> {
    await db.lessons.clear();
  },

  async clearByMapId(mapId: string): Promise<number> {
    return db.lessons.where('mapId').equals(mapId).delete();
  },
};
