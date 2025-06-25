import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import { 
  SDKConfig, 
  Review, 
  ReviewFilter, 
  User, 
  AnalyticsEvent,
  OfflineQueueItem,
  SDKError,
  ReviewAnalytics 
} from './types';
import { APIClient } from './api/APIClient';
import { OfflineManager } from './offline/OfflineManager';
import { AnalyticsManager } from './analytics/AnalyticsManager';
import { PushNotificationManager } from './push/PushNotificationManager';
import { Logger } from './utils/Logger';

export class ReviewInsightsSDK {
  private static instance: ReviewInsightsSDK | null = null;
  private config: SDKConfig;
  private apiClient: APIClient;
  private offlineManager: OfflineManager;
  private analyticsManager: AnalyticsManager;
  private pushManager: PushNotificationManager;
  private logger: Logger;
  private isInitialized: boolean = false;
  private currentUser: User | null = null;
  private sessionId: string;

  private constructor(config: SDKConfig) {
    this.config = config;
    this.logger = new Logger(config.debugMode);
    this.apiClient = new APIClient(config);
    this.offlineManager = new OfflineManager();
    this.analyticsManager = new AnalyticsManager(config.enableAnalytics);
    this.pushManager = new PushNotificationManager();
    this.sessionId = this.generateSessionId();
  }

  static initialize(config: SDKConfig): ReviewInsightsSDK {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    if (!ReviewInsightsSDK.instance) {
      ReviewInsightsSDK.instance = new ReviewInsightsSDK(config);
      ReviewInsightsSDK.instance.setup();
    }

    return ReviewInsightsSDK.instance;
  }

  static getInstance(): ReviewInsightsSDK {
    if (!ReviewInsightsSDK.instance) {
      throw new Error('SDK not initialized. Call ReviewInsightsSDK.initialize() first.');
    }
    return ReviewInsightsSDK.instance;
  }

  private async setup(): Promise<void> {
    try {
      // Setup offline queue
      if (this.config.enableOfflineMode) {
        await this.offlineManager.initialize();
        this.setupNetworkListener();
      }

      // Setup push notifications
      if (this.config.enablePushNotifications) {
        await this.pushManager.initialize();
      }

      // Load user data
      await this.loadUserData();

      // Send initialization event
      this.trackEvent('sdk_initialized', {
        version: '1.0.0',
        platform: DeviceInfo.getSystemName(),
        deviceId: await DeviceInfo.getUniqueId(),
      });

      this.isInitialized = true;
      this.logger.log('SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SDK', error);
      throw error;
    }
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      if (state.isConnected && this.offlineManager.hasQueuedItems()) {
        this.processOfflineQueue();
      }
    });
  }

  private async processOfflineQueue(): Promise<void> {
    const items = await this.offlineManager.getQueuedItems();
    
    for (const item of items) {
      try {
        switch (item.type) {
          case 'review':
            await this.apiClient.submitReview(item.data);
            break;
          case 'analytics':
            await this.apiClient.sendAnalytics(item.data);
            break;
          case 'user':
            await this.apiClient.updateUser(item.data);
            break;
        }
        
        await this.offlineManager.removeFromQueue(item.id);
      } catch (error) {
        this.logger.error('Failed to process offline item', error);
        await this.offlineManager.incrementRetryCount(item.id);
      }
    }
  }

  // User Management
  async identifyUser(userId: string, attributes?: Record<string, any>): Promise<void> {
    try {
      const user: User = {
        id: userId,
        attributes,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      if (await this.isOnline()) {
        await this.apiClient.identifyUser(user);
      } else {
        await this.offlineManager.addToQueue('user', user);
      }

      this.currentUser = user;
      await this.saveUserData(user);

      this.trackEvent('user_identified', { userId });
    } catch (error) {
      this.logger.error('Failed to identify user', error);
      throw this.createSDKError('USER_IDENTIFICATION_FAILED', error);
    }
  }

  async updateUserAttributes(attributes: Record<string, any>): Promise<void> {
    if (!this.currentUser) {
      throw this.createSDKError('NO_USER_IDENTIFIED');
    }

    try {
      const updatedUser = {
        ...this.currentUser,
        attributes: { ...this.currentUser.attributes, ...attributes },
        lastActiveAt: new Date(),
      };

      if (await this.isOnline()) {
        await this.apiClient.updateUser(updatedUser);
      } else {
        await this.offlineManager.addToQueue('user', updatedUser);
      }

      this.currentUser = updatedUser;
      await this.saveUserData(updatedUser);
    } catch (error) {
      this.logger.error('Failed to update user attributes', error);
      throw this.createSDKError('USER_UPDATE_FAILED', error);
    }
  }

  // Review Management
  async submitReview(review: Omit<Review, 'id' | 'date'>): Promise<Review> {
    try {
      const fullReview: Review = {
        ...review,
        id: this.generateId(),
        date: new Date(),
        author: review.author || this.currentUser?.name || 'Anonymous',
        platform: 'in-app',
        metadata: {
          ...review.metadata,
          sdkVersion: '1.0.0',
          deviceInfo: {
            platform: DeviceInfo.getSystemName(),
            version: DeviceInfo.getSystemVersion(),
            model: DeviceInfo.getModel(),
          },
        },
      };

      if (await this.isOnline()) {
        const response = await this.apiClient.submitReview(fullReview);
        this.trackEvent('review_submitted', {
          rating: review.rating,
          platform: review.platform,
        });
        return response;
      } else {
        await this.offlineManager.addToQueue('review', fullReview);
        return fullReview;
      }
    } catch (error) {
      this.logger.error('Failed to submit review', error);
      throw this.createSDKError('REVIEW_SUBMISSION_FAILED', error);
    }
  }

  async getReviews(filter?: ReviewFilter): Promise<Review[]> {
    try {
      const reviews = await this.apiClient.getReviews(filter);
      this.trackEvent('reviews_fetched', {
        count: reviews.length,
        filter: filter,
      });
      return reviews;
    } catch (error) {
      this.logger.error('Failed to fetch reviews', error);
      throw this.createSDKError('REVIEWS_FETCH_FAILED', error);
    }
  }

  async getReviewAnalytics(): Promise<ReviewAnalytics> {
    try {
      const analytics = await this.apiClient.getAnalytics();
      this.trackEvent('analytics_fetched');
      return analytics;
    } catch (error) {
      this.logger.error('Failed to fetch analytics', error);
      throw this.createSDKError('ANALYTICS_FETCH_FAILED', error);
    }
  }

  // Analytics
  trackEvent(name: string, properties?: Record<string, any>): void {
    if (!this.config.enableAnalytics) return;

    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: new Date(),
      userId: this.currentUser?.id,
      sessionId: this.sessionId,
    };

    this.analyticsManager.track(event);

    // Send to server
    if (this.isOnlineSync()) {
      this.apiClient.sendAnalytics([event]).catch(error => {
        this.logger.error('Failed to send analytics', error);
      });
    } else {
      this.offlineManager.addToQueue('analytics', event);
    }
  }

  trackScreen(screenName: string, properties?: Record<string, any>): void {
    this.trackEvent('screen_viewed', {
      screen_name: screenName,
      ...properties,
    });
  }

  // Push Notifications
  async enablePushNotifications(config?: { topics?: string[] }): Promise<void> {
    if (!this.config.enablePushNotifications) {
      throw this.createSDKError('PUSH_NOTIFICATIONS_DISABLED');
    }

    try {
      const token = await this.pushManager.requestPermission();
      await this.apiClient.registerPushToken(token, config?.topics);
      this.trackEvent('push_notifications_enabled');
    } catch (error) {
      this.logger.error('Failed to enable push notifications', error);
      throw this.createSDKError('PUSH_REGISTRATION_FAILED', error);
    }
  }

  async disablePushNotifications(): Promise<void> {
    try {
      await this.pushManager.unregister();
      await this.apiClient.unregisterPushToken();
      this.trackEvent('push_notifications_disabled');
    } catch (error) {
      this.logger.error('Failed to disable push notifications', error);
      throw this.createSDKError('PUSH_UNREGISTRATION_FAILED', error);
    }
  }

  // Utility Methods
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        '@ReviewInsights:user',
        '@ReviewInsights:session',
        '@ReviewInsights:offline_queue',
      ]);
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
    }
  }

  async logout(): Promise<void> {
    try {
      this.currentUser = null;
      await this.clearCache();
      this.sessionId = this.generateSessionId();
      this.trackEvent('user_logged_out');
    } catch (error) {
      this.logger.error('Failed to logout', error);
    }
  }

  // Private Methods
  private async loadUserData(): Promise<void> {
    try {
      const userData = await AsyncStorage.getItem('@ReviewInsights:user');
      if (userData) {
        this.currentUser = JSON.parse(userData);
      }
    } catch (error) {
      this.logger.error('Failed to load user data', error);
    }
  }

  private async saveUserData(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem('@ReviewInsights:user', JSON.stringify(user));
    } catch (error) {
      this.logger.error('Failed to save user data', error);
    }
  }

  private async isOnline(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected || false;
  }

  private isOnlineSync(): boolean {
    return NetInfo.fetch().then(state => state.isConnected || false) as any;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${this.generateId()}`;
  }

  private createSDKError(code: string, originalError?: any): SDKError {
    const error = new Error(originalError?.message || code) as SDKError;
    error.code = code;
    error.details = originalError;
    return error;
  }

  // Getters
  get isReady(): boolean {
    return this.isInitialized;
  }

  get user(): User | null {
    return this.currentUser;
  }

  get session(): string {
    return this.sessionId;
  }
}