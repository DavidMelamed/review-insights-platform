export interface SDKConfig {
  apiKey: string;
  apiUrl?: string;
  environment?: 'production' | 'development' | 'staging';
  enableAnalytics?: boolean;
  enablePushNotifications?: boolean;
  enableOfflineMode?: boolean;
  customHeaders?: Record<string, string>;
  debugMode?: boolean;
}

export interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  author: string;
  date: Date;
  platform: ReviewPlatform;
  verified?: boolean;
  helpful?: number;
  response?: string;
  metadata?: Record<string, any>;
}

export type ReviewPlatform = 
  | 'in-app'
  | 'app-store'
  | 'google-play'
  | 'trustpilot'
  | 'g2'
  | 'custom';

export interface ReviewPromptConfig {
  title?: string;
  message?: string;
  positiveThreshold?: number; // Rating threshold to redirect to app store
  showAfterActions?: number; // Number of actions before showing prompt
  cooldownDays?: number; // Days to wait before showing again
  customUI?: ReviewPromptUI;
}

export interface ReviewPromptUI {
  backgroundColor?: string;
  textColor?: string;
  primaryColor?: string;
  borderRadius?: number;
  fontFamily?: string;
}

export interface ReviewCollectionOptions {
  allowAnonymous?: boolean;
  requireEmail?: boolean;
  enablePhotos?: boolean;
  enableVideos?: boolean;
  maxMediaSize?: number; // in MB
  customFields?: CustomField[];
  platforms?: ReviewPlatform[];
}

export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean';
  required?: boolean;
  options?: string[]; // For select/multiselect
  validation?: FieldValidation;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId: string;
}

export interface ReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  trends: {
    daily: TrendData[];
    weekly: TrendData[];
    monthly: TrendData[];
  };
  topKeywords: Array<{ word: string; count: number }>;
  responseRate: number;
  averageResponseTime?: number; // in hours
}

export interface TrendData {
  date: Date;
  averageRating: number;
  reviewCount: number;
  sentiment: number;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  attributes?: Record<string, any>;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface PushNotificationConfig {
  enabled: boolean;
  topics?: string[];
  customSound?: string;
  badge?: boolean;
  alert?: boolean;
}

export interface OfflineQueueItem {
  id: string;
  type: 'review' | 'analytics' | 'user';
  data: any;
  timestamp: Date;
  retryCount: number;
}

export interface SDKError extends Error {
  code: string;
  statusCode?: number;
  details?: any;
}

export interface ReviewResponse {
  id: string;
  content: string;
  authorName: string;
  authorRole: string;
  date: Date;
}

export interface ReviewFilter {
  platforms?: ReviewPlatform[];
  rating?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  verified?: boolean;
  hasResponse?: boolean;
  searchQuery?: string;
  sortBy?: 'date' | 'rating' | 'helpful';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}