import { db } from '../db';
import type { NodeProgress } from '@/domain/types';
import { cloudSyncManager } from '@/lib/cloud/syncManager';

export const progressRepo = {
  async getByMapId(mapId: string): Promise<NodeProgress[]> {
    return db.progress.where('mapId').equals(mapId).toArray();
  },

  async getByNode(mapId: string, nodeId: string): Promise<NodeProgress | undefined> {
    return db.progress.get([mapId, nodeId]);
  },

  async save(progress: NodeProgress): Promise<void> {
    await db.progress.put(progress);
    void cloudSyncManager.notifyLocalMutation();
  },

  async batchSave(items: NodeProgress[]): Promise<void> {
    await db.progress.bulkPut(items);
    void cloudSyncManager.notifyLocalMutation();
  },

  async delete(mapId: string, nodeId: string): Promise<void> {
    await db.progress.delete([mapId, nodeId]);
    void cloudSyncManager.notifyLocalMutation();
  },

  async deleteByMapId(mapId: string): Promise<number> {
    const count = await db.progress.where('mapId').equals(mapId).delete();
    void cloudSyncManager.notifyLocalMutation();
    return count;
  },
};
