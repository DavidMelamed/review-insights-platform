import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { PushNotificationConfig } from '../types';

export class PushNotificationManager {
  private isInitialized = false;
  private token: string | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    PushNotification.configure({
      onRegister: (token) => {
        this.token = token.token;
      },

      onNotification: (notification) => {
        // Handle notification
        console.log('Notification received:', notification);

        // Required on iOS
        notification.finish(PushNotificationIOS.FetchResult.NoData);
      },

      onRegistrationError: (err) => {
        console.error('Push registration error:', err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: false, // Don't request on init
    });

    this.isInitialized = true;
  }

  async requestPermission(): Promise<string> {
    return new Promise((resolve, reject) => {
      PushNotification.requestPermissions().then((permissions) => {
        if (permissions.alert || permissions.badge || permissions.sound) {
          if (this.token) {
            resolve(this.token);
          } else {
            // Wait for token
            const checkToken = setInterval(() => {
              if (this.token) {
                clearInterval(checkToken);
                resolve(this.token);
              }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
              clearInterval(checkToken);
              reject(new Error('Failed to get push token'));
            }, 10000);
          }
        } else {
          reject(new Error('Push permissions denied'));
        }
      });
    });
  }

  async unregister(): Promise<void> {
    if (Platform.OS === 'ios') {
      PushNotification.abandonPermissions();
    }
    this.token = null;
  }

  scheduleLocalNotification(
    title: string,
    message: string,
    date: Date,
    data?: any
  ): void {
    PushNotification.localNotificationSchedule({
      title,
      message,
      date,
      userInfo: data,
      playSound: true,
      soundName: 'default',
    });
  }

  showLocalNotification(
    title: string,
    message: string,
    data?: any
  ): void {
    PushNotification.localNotification({
      title,
      message,
      userInfo: data,
      playSound: true,
      soundName: 'default',
      vibrate: true,
    });
  }

  cancelAllLocalNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  setBadgeCount(count: number): void {
    PushNotification.setApplicationIconBadgeNumber(count);
  }

  getToken(): string | null {
    return this.token;
  }
}

// iOS specific imports
let PushNotificationIOS: any;
if (Platform.OS === 'ios') {
  PushNotificationIOS = require('@react-native-community/push-notification-ios').default;
}