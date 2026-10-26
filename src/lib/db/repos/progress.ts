import { db } from '../db';
import type { NodeProgress } from '@/domain/types';

export const progressRepo = {
  async getByMapId(mapId: string): Promise<NodeProgress[]> {
    return db.progress.where('mapId').equals(mapId).toArray();
  },

  async getByNode(mapId: string, nodeId: string): Promise<NodeProgress | undefined> {
    return db.progress.get([mapId, nodeId]);
  },

  async save(progress: NodeProgress): Promise<void> {
    await db.progress.put(progress);
  },

  async batchSave(items: NodeProgress[]): Promise<void> {
    await db.progress.bulkPut(items);
  },

  async deleteByMapId(mapId: string): Promise<number> {
    return db.progress.where('mapId').equals(mapId).delete();
  },
};
