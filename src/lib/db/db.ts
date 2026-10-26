import Dexie, { type Table } from 'dexie';
import { DB_NAME } from '@/lib/storage/keys';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';

export interface KVRecord {
  key: string;
  value: unknown;
}

export class MapCraftDatabase extends Dexie {
  maps!: Table<LearningMap, string>;
  progress!: Table<NodeProgress, [string, string]>;
  lessons!: Table<Lesson, [string, string]>;
  kv!: Table<KVRecord, string>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      maps: 'id, updatedAt, title',
      progress: '[mapId+nodeId], mapId, status',
      lessons: '[mapId+nodeId], mapId, createdAt',
      kv: 'key',
    });
  }
}

export const db = new MapCraftDatabase();
