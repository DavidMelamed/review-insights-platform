import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsEvent } from '../types';

const EVENTS_KEY = '@ReviewInsights:analytics_events';
const MAX_EVENTS = 1000;

export class AnalyticsManager {
  private enabled: boolean;
  private events: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.loadEvents();
  }

  track(event: AnalyticsEvent): void {
    if (!this.enabled) return;

    this.events.push(event);

    // Limit events in memory
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }

    // Save to storage
    this.saveEvents();

    // Schedule flush
    this.scheduleFlush();
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
    this.saveEvents();
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    this.clearFlushTimer();
  }

  private async loadEvents(): Promise<void> {
    try {
      const eventsData = await AsyncStorage.getItem(EVENTS_KEY);
      if (eventsData) {
        const events = JSON.parse(eventsData);
        this.events = events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));
      }
    } catch (error) {
      console.error('Failed to load analytics events:', error);
    }
  }

  private async saveEvents(): Promise<void> {
    try {
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.error('Failed to save analytics events:', error);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    // Flush events after 30 seconds
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      // In a real implementation, this would send events to the server
      // For now, we just clear old events
      this.pruneOldEvents();
    }, 30000);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private pruneOldEvents(): void {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    this.events = this.events.filter(
      event => event.timestamp > oneDayAgo
    );
    this.saveEvents();
  }
}