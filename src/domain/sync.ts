import type { LearningMap, NodeProgress, Lesson } from './types';

/**
 * 本地優先（Local-First）雲端同步純函式合併引擎
 * 支援：
 * 1. 多裝置無衝突新增合併（Union）
 * 2. 同 ID 項目依時間戳記最後修改優先（Last-Write-Wins）
 * 3. 刪除墓碑（Deleted Tombstones）防止已刪除的地圖從雲端死灰復燃
 */

export interface SyncSnapshot {
  maps: LearningMap[];
  progress: NodeProgress[];
  lessons: Lesson[];
  /** 已刪除的地圖 ID -> 刪除發生時間戳記 (ms) */
  deletedMapIds?: Record<string, number>;
}

export interface SyncMergeStats {
  pulledMaps: number;
  pushedMaps: number;
  updatedMaps: number;
  deletedMaps: number;
}

export interface SyncMergeResult extends SyncSnapshot {
  deletedMapIds: Record<string, number>;
  stats: SyncMergeStats;
}

/**
 * 合併本機（Local）與雲端（Remote）快照資料
 */
export function mergeSyncData(
  local: SyncSnapshot,
  remote: SyncSnapshot
): SyncMergeResult {
  // 1. 合併刪除墓碑（取較新的刪除時間）
  const mergedTombstones: Record<string, number> = {
    ...(remote.deletedMapIds || {}),
  };
  if (local.deletedMapIds) {
    for (const [mapId, deletedAt] of Object.entries(local.deletedMapIds)) {
      const existing = mergedTombstones[mapId] || 0;
      if (deletedAt > existing) {
        mergedTombstones[mapId] = deletedAt;
      }
    }
  }

  // 2. 合併地圖（Maps）
  const localMapById = new Map<string, LearningMap>();
  for (const m of local.maps) {
    localMapById.set(m.id, m);
  }

  const remoteMapById = new Map<string, LearningMap>();
  for (const m of remote.maps) {
    remoteMapById.set(m.id, m);
  }

  const allMapIds = new Set<string>([
    ...localMapById.keys(),
    ...remoteMapById.keys(),
  ]);

  const mergedMaps: LearningMap[] = [];
  const survivingMapIds = new Set<string>();
  const stats: SyncMergeStats = {
    pulledMaps: 0,
    pushedMaps: 0,
    updatedMaps: 0,
    deletedMaps: 0,
  };

  for (const mapId of allMapIds) {
    const localMap = localMapById.get(mapId);
    const remoteMap = remoteMapById.get(mapId);
    const deletedAt = mergedTombstones[mapId] || 0;

    const latestMapTime = Math.max(
      localMap?.updatedAt || 0,
      remoteMap?.updatedAt || 0
    );

    // 若刪除時間晚於或等於該地圖最後修改時間，視為已被刪除
    if (deletedAt > 0 && deletedAt >= latestMapTime) {
      stats.deletedMaps += 1;
      continue;
    }

    // 若該地圖在刪除之後又有更新（重新復活），移除舊墓碑
    if (deletedAt > 0 && latestMapTime > deletedAt) {
      delete mergedTombstones[mapId];
    }

    if (localMap && !remoteMap) {
      mergedMaps.push(localMap);
      survivingMapIds.add(mapId);
      stats.pushedMaps += 1;
    } else if (!localMap && remoteMap) {
      mergedMaps.push(remoteMap);
      survivingMapIds.add(mapId);
      stats.pulledMaps += 1;
    } else if (localMap && remoteMap) {
      survivingMapIds.add(mapId);
      if (remoteMap.updatedAt > localMap.updatedAt) {
        mergedMaps.push(remoteMap);
        stats.updatedMaps += 1;
      } else {
        mergedMaps.push(localMap);
        if (localMap.updatedAt > remoteMap.updatedAt) {
          stats.updatedMaps += 1;
        }
      }
    }
  }

  // 依 updatedAt 降序排列
  mergedMaps.sort((a, b) => b.updatedAt - a.updatedAt);

  // 3. 合併學習進度（Progress）：僅保留存活地圖的進度，以 [mapId, nodeId] + updatedAt LWW
  const progressMap = new Map<string, NodeProgress>();
  for (const p of remote.progress) {
    if (!survivingMapIds.has(p.mapId)) continue;
    progressMap.set(`${p.mapId}::${p.nodeId}`, p);
  }
  for (const p of local.progress) {
    if (!survivingMapIds.has(p.mapId)) continue;
    const key = `${p.mapId}::${p.nodeId}`;
    const existing = progressMap.get(key);
    if (!existing || p.updatedAt >= existing.updatedAt) {
      progressMap.set(key, p);
    }
  }

  // 4. 合併教材筆記（Lessons）：僅保留存活地圖的教材，以 [mapId, nodeId] + createdAt LWW
  const lessonsMap = new Map<string, Lesson>();
  for (const l of remote.lessons) {
    if (!survivingMapIds.has(l.mapId)) continue;
    lessonsMap.set(`${l.mapId}::${l.nodeId}`, l);
  }
  for (const l of local.lessons) {
    if (!survivingMapIds.has(l.mapId)) continue;
    const key = `${l.mapId}::${l.nodeId}`;
    const existing = lessonsMap.get(key);
    if (!existing || l.createdAt >= existing.createdAt) {
      lessonsMap.set(key, l);
    }
  }

  return {
    maps: mergedMaps,
    progress: Array.from(progressMap.values()),
    lessons: Array.from(lessonsMap.values()),
    deletedMapIds: mergedTombstones,
    stats,
  };
}

