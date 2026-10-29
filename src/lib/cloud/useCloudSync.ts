import { useState, useEffect, useCallback } from 'react';
import { cloudSyncManager, type CloudSyncState } from './syncManager';

export function useCloudSync() {
  const [syncState, setSyncState] = useState<CloudSyncState>(() =>
    cloudSyncManager.getState()
  );

  useEffect(() => {
    void cloudSyncManager.init();
    const unsubscribe = cloudSyncManager.subscribe((next) => {
      setSyncState(next);
    });
    return unsubscribe;
  }, []);

  const triggerSync = useCallback(async () => {
    return cloudSyncManager.syncNow();
  }, []);

  const refreshState = useCallback(async () => {
    await cloudSyncManager.refreshConfigState();
  }, []);

  return {
    ...syncState,
    triggerSync,
    refreshState,
  };
}

