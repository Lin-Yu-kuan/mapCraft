import { db } from '../db/db';
import { settingsRepo } from '../db/repos/settings';
import { BACKUP_FORMAT } from '../storage/keys';
import { redact } from '../llm/redact';
import { BackupSchema, type BackupData } from '@/domain/schemas';
import { mergeSyncData, type SyncSnapshot } from '@/domain/sync';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';
import {
  getGoogleDriveToken,
  ensureMapCraftFolder,
  findDriveSyncFile,
  downloadDriveJsonFile,
  uploadDriveJsonFile,
  GDRIVE_SYNC_FILENAME,
} from './googleDrive';

export type CloudSyncStatus =
  | 'disabled'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

export interface CloudSyncState {
  status: CloudSyncStatus;
  autoSyncEnabled: boolean;
  isConnected: boolean;
  lastSyncedAt?: number;
  pendingChanges: boolean;
  errorMessage?: string;
}

type Listener = (state: CloudSyncState) => void;

const SENSITIVE_KEY_PATTERN =
  /(?:sk-[a-zA-Z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ya29\.[A-Za-z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_.-]+)/;

class CloudSyncManager {
  private state: CloudSyncState = {
    status: 'disabled',
    autoSyncEnabled: false,
    isConnected: false,
    pendingChanges: false,
  };

  private listeners = new Set<Listener>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isSyncingPromise: Promise<boolean> | null = null;
  private initialized = false;

  public getState(): CloudSyncState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private updateState(patch: Partial<CloudSyncState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };
    this.emit();
  }

  /**
   * 初始化雲端同步管理員（載入設定並綁定網路恢復事件）
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      await this.refreshConfigState();
      return;
    }
    this.initialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.state.autoSyncEnabled && this.state.isConnected) {
          if (this.state.pendingChanges || this.state.status === 'offline') {
            void this.syncNow();
          } else {
            this.updateState({ status: this.state.lastSyncedAt ? 'synced' : 'idle' });
          }
        }
      });

      window.addEventListener('offline', () => {
        if (this.state.autoSyncEnabled && this.state.isConnected) {
          this.updateState({ status: 'offline' });
        }
      });
    }

    await this.refreshConfigState();

    // 若啟用自動同步且目前已連線，啟動時在背景執行一次初始雙向同步
    if (
      this.state.autoSyncEnabled &&
      this.state.isConnected &&
      (typeof navigator === 'undefined' || navigator.onLine)
    ) {
      this.scheduleBackgroundSync(1200);
    }
  }

  /**
   * 重新讀取設定與 Token 狀態
   */
  public async refreshConfigState(): Promise<void> {
    try {
      const settings = await settingsRepo.getSettings();
      const token = getGoogleDriveToken();
      const isConnected = Boolean(token && token.trim().length > 0);
      const autoSyncEnabled = Boolean(settings.gdriveAutoSync);

      let nextStatus: CloudSyncStatus = 'disabled';
      if (isConnected && autoSyncEnabled) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          nextStatus = 'offline';
        } else if (this.state.status === 'syncing') {
          nextStatus = 'syncing';
        } else if (settings.lastSyncedAt) {
          nextStatus = 'synced';
        } else {
          nextStatus = 'idle';
        }
      } else if (isConnected) {
        nextStatus = settings.lastSyncedAt ? 'synced' : 'idle';
      }

      this.updateState({
        isConnected,
        autoSyncEnabled,
        lastSyncedAt: settings.lastSyncedAt,
        status: nextStatus,
        errorMessage: undefined,
      });
    } catch {
      // ignore DB closed during test teardown
    }
  }

  /**
   * 當本機 IndexedDB 資料發生變更（新增/修改/刪除地圖、更新進度、生成筆記）時呼叫
   * 遵循 Local-First：本機寫入立即完成，雲端同步於背景防抖排程執行
   */
  public async notifyLocalMutation(options?: { deletedMapId?: string }): Promise<void> {
    try {
      if (options?.deletedMapId) {
        const settings = await settingsRepo.getSettings();
        const deletedMapIds = {
          ...(settings.deletedMapIds || {}),
          [options.deletedMapId]: Date.now(),
        };
        await settingsRepo.saveSettings({ deletedMapIds });
      }

      const token = getGoogleDriveToken();
      const isConnected = Boolean(token && token.trim().length > 0);
      if (!isConnected) return;

      const settings = await settingsRepo.getSettings();
      if (!settings.gdriveAutoSync) return;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.updateState({
          isConnected: true,
          autoSyncEnabled: true,
          pendingChanges: true,
          status: 'offline',
        });
        return;
      }

      this.updateState({
        isConnected: true,
        autoSyncEnabled: true,
        pendingChanges: true,
      });

      this.scheduleBackgroundSync(2500);
    } catch {
      // ignore background error in non-browser test environments
    }
  }

  /**
   * 排程背景防抖同步
   */
  public scheduleBackgroundSync(delayMs = 2500): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.syncNow();
    }, delayMs);
  }

  /**
   * 立即執行雙向雲端同步（Local <-> Google Drive）
   */
  public async syncNow(): Promise<boolean> {
    if (this.isSyncingPromise) {
      return this.isSyncingPromise;
    }

    this.isSyncingPromise = this.performSync().finally(() => {
      this.isSyncingPromise = null;
    });

    return this.isSyncingPromise;
  }

  private async performSync(): Promise<boolean> {
    const token = getGoogleDriveToken().trim();
    if (!token) {
      this.updateState({
        status: 'disabled',
        isConnected: false,
        errorMessage: '尚未連結 Google Drive 帳號',
      });
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState({
        status: 'offline',
        pendingChanges: true,
      });
      return false;
    }

    this.updateState({
      status: 'syncing',
      isConnected: true,
      errorMessage: undefined,
    });

    try {
      const settings = await settingsRepo.getSettings();

      // 1. 讀取本機目前快照
      const [localMaps, localProgress, localLessons] = await Promise.all([
        db.maps.toArray(),
        db.progress.toArray(),
        db.lessons.toArray(),
      ]);

      const localSnapshot: SyncSnapshot = {
        maps: localMaps,
        progress: localProgress,
        lessons: localLessons,
        deletedMapIds: settings.deletedMapIds || {},
      };

      // 2. 確保 Google Drive MapCraft 資料夾存在
      const folderId = await ensureMapCraftFolder(token, settings.gdriveFolderId);

      // 3. 檢查雲端是否已有同步主檔
      const existingSyncFileId = await findDriveSyncFile(
        token,
        folderId,
        settings.gdriveSyncFileId
      );

      let mergedMaps: LearningMap[] = localMaps;
      let mergedProgress: NodeProgress[] = localProgress;
      let mergedLessons: Lesson[] = localLessons;
      let mergedTombstones: Record<string, number> = settings.deletedMapIds || {};
      let pulledOrUpdated = false;

      if (existingSyncFileId) {
        const remoteJsonStr = await downloadDriveJsonFile(existingSyncFileId, token);
        let remoteBackup: BackupData | null = null;
        try {
          const parsed = JSON.parse(remoteJsonStr);
          remoteBackup = BackupSchema.parse(parsed);
        } catch {
          remoteBackup = null;
        }

        if (remoteBackup) {
          const remoteDeletedMapIds =
            remoteBackup.settings &&
            typeof remoteBackup.settings.deletedMapIds === 'object' &&
            remoteBackup.settings.deletedMapIds !== null
              ? (remoteBackup.settings.deletedMapIds as Record<string, number>)
              : {};

          const remoteSnapshot: SyncSnapshot = {
            maps: remoteBackup.maps as unknown as LearningMap[],
            progress: remoteBackup.progress as unknown as NodeProgress[],
            lessons: remoteBackup.lessons as unknown as Lesson[],
            deletedMapIds: remoteDeletedMapIds,
          };

          const mergeResult = mergeSyncData(localSnapshot, remoteSnapshot);
          mergedMaps = mergeResult.maps;
          mergedProgress = mergeResult.progress;
          mergedLessons = mergeResult.lessons;
          mergedTombstones = mergeResult.deletedMapIds;

          if (
            mergeResult.stats.pulledMaps > 0 ||
            mergeResult.stats.updatedMaps > 0 ||
            mergeResult.stats.deletedMaps > 0
          ) {
            pulledOrUpdated = true;
          }

          // 將合併結果原子寫回本機 IndexedDB
          const survivingIds = new Set(mergedMaps.map((m) => m.id));
          const toDeleteLocalIds = localMaps
            .map((m) => m.id)
            .filter((id) => !survivingIds.has(id));

          await db.transaction('rw', db.maps, db.progress, db.lessons, async () => {
            for (const delId of toDeleteLocalIds) {
              await db.maps.delete(delId);
              await db.progress.where('mapId').equals(delId).delete();
              await db.lessons.where('mapId').equals(delId).delete();
            }
            if (mergedMaps.length > 0) {
              await db.maps.bulkPut(mergedMaps);
            }
            if (mergedProgress.length > 0) {
              await db.progress.bulkPut(mergedProgress);
            }
            if (mergedLessons.length > 0) {
              await db.lessons.bulkPut(mergedLessons);
            }
          });
        }
      }

      // 4. 封裝為標準 BackupData 並執行安全性檢查
      const now = Date.now();
      const syncBackupPayload: BackupData = {
        format: BACKUP_FORMAT,
        schemaVersion: 1,
        exportedAt: now,
        app: {
          name: 'MapCraft',
          version: '0.1.0',
        },
        maps: mergedMaps as unknown as Record<string, unknown>[],
        progress: mergedProgress as unknown as Record<string, unknown>[],
        lessons: mergedLessons as unknown as Record<string, unknown>[],
        settings: {
          uiLanguage: settings.uiLanguage,
          theme: settings.theme,
          deletedMapIds: mergedTombstones,
        },
      };

      const serialized = JSON.stringify(syncBackupPayload);
      if (SENSITIVE_KEY_PATTERN.test(serialized)) {
        throw new Error('安全性防護：偵測到疑似金鑰特徵，已攔截雲端上傳。');
      }

      // 5. 上傳最新合併快照至 Google Drive
      const { fileId } = await uploadDriveJsonFile({
        token,
        folderId,
        existingFileId: existingSyncFileId,
        fileName: GDRIVE_SYNC_FILENAME,
        jsonContent: serialized,
      });

      // 6. 更新設定紀錄
      await settingsRepo.saveSettings({
        gdriveFolderId: folderId,
        gdriveSyncFileId: fileId,
        lastSyncedAt: now,
        deletedMapIds: mergedTombstones,
      });

      this.updateState({
        status: 'synced',
        isConnected: true,
        lastSyncedAt: now,
        pendingChanges: false,
        errorMessage: undefined,
      });

      // 若有從雲端拉取新地圖或更新，派發全域事件讓 LibraryPage / MapPage 自動刷新
      if (pulledOrUpdated && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mapcraft:cloud-synced'));
      }

      return true;
    } catch (err) {
      const msg = redact(err instanceof Error ? err.message : String(err));
      this.updateState({
        status: 'error',
        errorMessage: msg,
      });
      return false;
    }
  }
}

export const cloudSyncManager = new CloudSyncManager();

