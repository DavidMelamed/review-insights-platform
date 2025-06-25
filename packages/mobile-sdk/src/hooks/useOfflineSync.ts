import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { OfflineQueueItem } from '../types';
import { OfflineManager } from '../offline/OfflineManager';

interface UseOfflineSyncResult {
  isOnline: boolean;
  queuedItems: OfflineQueueItem[];
  queueCount: number;
  syncing: boolean;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const useOfflineSync = (): UseOfflineSyncResult => {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedItems, setQueuedItems] = useState<OfflineQueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [offlineManager] = useState(() => new OfflineManager());

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
    });

    // Get initial state
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected || false);
    });

    return unsubscribe;
  }, []);

  // Load queued items
  const loadQueuedItems = useCallback(async () => {
    try {
      const items = await offlineManager.getQueuedItems();
      setQueuedItems(items);
    } catch (error) {
      console.error('Failed to load queued items:', error);
    }
  }, [offlineManager]);

  // Sync queued items
  const syncNow = useCallback(async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      // This would typically call the SDK's processOfflineQueue method
      // For now, we'll simulate the sync
      const items = await offlineManager.getQueuedItems();
      
      for (const item of items) {
        // Process each item
        // In a real implementation, this would send to the server
        await new Promise(resolve => setTimeout(resolve, 100));
        await offlineManager.removeFromQueue(item.id);
      }

      setLastSyncTime(new Date());
      await loadQueuedItems();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncing, offlineManager, loadQueuedItems]);

  // Clear queue
  const clearQueue = useCallback(async () => {
    try {
      await offlineManager.clearQueue();
      await loadQueuedItems();
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  }, [offlineManager, loadQueuedItems]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && queuedItems.length > 0 && !syncing) {
      syncNow();
    }
  }, [isOnline, queuedItems.length, syncing, syncNow]);

  // Load items on mount
  useEffect(() => {
    loadQueuedItems();

    // Refresh queue periodically
    const interval = setInterval(loadQueuedItems, 5000);
    return () => clearInterval(interval);
  }, [loadQueuedItems]);

  return {
    isOnline,
    queuedItems,
    queueCount: queuedItems.length,
    syncing,
    lastSyncTime,
    syncNow,
    clearQueue,
  };
};