import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueueItem } from '../types';

const QUEUE_KEY = '@ReviewInsights:offline_queue';

export class OfflineManager {
  async initialize(): Promise<void> {
    // Initialize offline queue if it doesn't exist
    const queue = await this.getQueue();
    if (!queue) {
      await this.saveQueue([]);
    }
  }

  async addToQueue(type: OfflineQueueItem['type'], data: any): Promise<void> {
    const queue = await this.getQueue();
    const item: OfflineQueueItem = {
      id: this.generateId(),
      type,
      data,
      timestamp: new Date(),
      retryCount: 0,
    };

    queue.push(item);
    await this.saveQueue(queue);
  }

  async getQueuedItems(): Promise<OfflineQueueItem[]> {
    const queue = await this.getQueue();
    return queue;
  }

  async removeFromQueue(itemId: string): Promise<void> {
    const queue = await this.getQueue();
    const filteredQueue = queue.filter(item => item.id !== itemId);
    await this.saveQueue(filteredQueue);
  }

  async incrementRetryCount(itemId: string): Promise<void> {
    const queue = await this.getQueue();
    const item = queue.find(item => item.id === itemId);
    
    if (item) {
      item.retryCount++;
      // Remove items that have been retried too many times
      if (item.retryCount > 5) {
        await this.removeFromQueue(itemId);
      } else {
        await this.saveQueue(queue);
      }
    }
  }

  async clearQueue(): Promise<void> {
    await this.saveQueue([]);
  }

  hasQueuedItems(): boolean {
    // This is a sync check, we'll need to maintain state
    return true; // Simplified for now
  }

  private async getQueue(): Promise<OfflineQueueItem[]> {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_KEY);
      if (!queueData) return [];
      
      const queue = JSON.parse(queueData);
      // Convert date strings back to Date objects
      return queue.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      return [];
    }
  }

  private async saveQueue(queue: OfflineQueueItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}