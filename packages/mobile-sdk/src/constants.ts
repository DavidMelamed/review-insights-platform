export const SDK_VERSION = '1.0.0';

export const DEFAULT_CONFIG = {
  apiUrl: 'https://api.reviewinsights.ai/v1',
  environment: 'production' as const,
  enableAnalytics: true,
  enablePushNotifications: false,
  enableOfflineMode: true,
  debugMode: false,
};

export const STORAGE_KEYS = {
  USER: '@ReviewInsights:user',
  SESSION: '@ReviewInsights:session',
  OFFLINE_QUEUE: '@ReviewInsights:offline_queue',
  ANALYTICS_EVENTS: '@ReviewInsights:analytics_events',
  REVIEW_PROMPT: {
    LAST_SHOWN: '@ReviewPrompt:lastShown',
    HAS_RATED: '@ReviewPrompt:hasRated',
    ACTION_COUNT: '@ReviewPrompt:actionCount',
  },
};

export const REVIEW_PLATFORMS = {
  IN_APP: 'in-app',
  APP_STORE: 'app-store',
  GOOGLE_PLAY: 'google-play',
  TRUSTPILOT: 'trustpilot',
  G2: 'g2',
  CUSTOM: 'custom',
} as const;

export const ERROR_CODES = {
  // SDK errors
  SDK_NOT_INITIALIZED: 'SDK_NOT_INITIALIZED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  
  // User errors
  NO_USER_IDENTIFIED: 'NO_USER_IDENTIFIED',
  USER_IDENTIFICATION_FAILED: 'USER_IDENTIFICATION_FAILED',
  USER_UPDATE_FAILED: 'USER_UPDATE_FAILED',
  
  // Review errors
  REVIEW_SUBMISSION_FAILED: 'REVIEW_SUBMISSION_FAILED',
  REVIEWS_FETCH_FAILED: 'REVIEWS_FETCH_FAILED',
  INVALID_REVIEW_DATA: 'INVALID_REVIEW_DATA',
  
  // Analytics errors
  ANALYTICS_FETCH_FAILED: 'ANALYTICS_FETCH_FAILED',
  ANALYTICS_DISABLED: 'ANALYTICS_DISABLED',
  
  // Push notification errors
  PUSH_NOTIFICATIONS_DISABLED: 'PUSH_NOTIFICATIONS_DISABLED',
  PUSH_REGISTRATION_FAILED: 'PUSH_REGISTRATION_FAILED',
  PUSH_UNREGISTRATION_FAILED: 'PUSH_UNREGISTRATION_FAILED',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  OFFLINE_MODE_DISABLED: 'OFFLINE_MODE_DISABLED',
  
  // API errors
  API_ERROR: 'API_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
};

export const ANALYTICS_EVENTS = {
  // SDK events
  SDK_INITIALIZED: 'sdk_initialized',
  
  // User events
  USER_IDENTIFIED: 'user_identified',
  USER_LOGGED_OUT: 'user_logged_out',
  
  // Review events
  REVIEW_SUBMITTED: 'review_submitted',
  REVIEW_COLLECTED: 'review_collected',
  REVIEWS_FETCHED: 'reviews_fetched',
  
  // Review prompt events
  REVIEW_PROMPT_SHOWN: 'review_prompt_shown',
  REVIEW_PROMPT_RATED: 'review_prompt_rated',
  REVIEW_PROMPT_STORE_REDIRECT: 'review_prompt_store_redirect',
  REVIEW_PROMPT_FEEDBACK_SUBMITTED: 'review_prompt_feedback_submitted',
  
  // Analytics events
  ANALYTICS_FETCHED: 'analytics_fetched',
  
  // Push notification events
  PUSH_NOTIFICATIONS_ENABLED: 'push_notifications_enabled',
  PUSH_NOTIFICATIONS_DISABLED: 'push_notifications_disabled',
  
  // Screen events
  SCREEN_VIEWED: 'screen_viewed',
};

export const DEFAULT_REVIEW_PROMPT_CONFIG = {
  title: 'Enjoying our app?',
  message: 'Would you mind taking a moment to rate us?',
  positiveThreshold: 4,
  showAfterActions: 5,
  cooldownDays: 7,
};

export const DEFAULT_COLLECTION_OPTIONS = {
  allowAnonymous: true,
  requireEmail: false,
  enablePhotos: true,
  enableVideos: true,
  maxMediaSize: 10, // MB
};

export const SENTIMENT_THRESHOLDS = {
  POSITIVE: 0.3,
  NEGATIVE: -0.3,
};

export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  UPLOAD: 120000, // 2 minutes for media uploads
};

export const MAX_RETRY_ATTEMPTS = 3;
export const MAX_OFFLINE_QUEUE_SIZE = 100;
export const MAX_ANALYTICS_EVENTS = 1000;