import { 
  SDKConfig, 
  Review, 
  ReviewFilter, 
  User, 
  AnalyticsEvent,
  ReviewAnalytics,
  SDKError 
} from '../types';

export class APIClient {
  private config: SDKConfig;
  private baseUrl: string;

  constructor(config: SDKConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://api.reviewinsights.ai/v1';
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      'X-SDK-Version': '1.0.0',
      'X-SDK-Platform': 'react-native',
      ...this.config.customHeaders,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw this.createSDKError('NETWORK_ERROR', error);
      }
      throw error;
    }
  }

  async parseError(response: Response): Promise<SDKError> {
    try {
      const errorData = await response.json();
      const error = new Error(errorData.message || 'Request failed') as SDKError;
      error.code = errorData.code || 'API_ERROR';
      error.statusCode = response.status;
      error.details = errorData;
      return error;
    } catch {
      const error = new Error(`Request failed with status ${response.status}`) as SDKError;
      error.code = 'API_ERROR';
      error.statusCode = response.status;
      return error;
    }
  }

  createSDKError(code: string, originalError?: any): SDKError {
    const error = new Error(originalError?.message || code) as SDKError;
    error.code = code;
    error.details = originalError;
    return error;
  }

  // User endpoints
  async identifyUser(user: User): Promise<void> {
    await this.request('/users/identify', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(user: User): Promise<void> {
    await this.request(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  }

  // Review endpoints
  async submitReview(review: Review): Promise<Review> {
    return this.request<Review>('/reviews', {
      method: 'POST',
      body: JSON.stringify(review),
    });
  }

  async getReviews(filter?: ReviewFilter): Promise<Review[]> {
    const params = new URLSearchParams();
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'platforms' && Array.isArray(value)) {
            params.append(key, value.join(','));
          } else if (key === 'rating' && typeof value === 'object') {
            if (value.min !== undefined) params.append('ratingMin', value.min.toString());
            if (value.max !== undefined) params.append('ratingMax', value.max.toString());
          } else if (key === 'dateRange' && typeof value === 'object') {
            if (value.start) params.append('startDate', value.start.toISOString());
            if (value.end) params.append('endDate', value.end.toISOString());
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const queryString = params.toString();
    const endpoint = `/reviews${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<{ reviews: Review[] }>(endpoint);
    return response.reviews;
  }

  async getReview(reviewId: string): Promise<Review> {
    return this.request<Review>(`/reviews/${reviewId}`);
  }

  // Analytics endpoints
  async getAnalytics(): Promise<ReviewAnalytics> {
    return this.request<ReviewAnalytics>('/analytics/reviews');
  }

  async sendAnalytics(events: AnalyticsEvent[]): Promise<void> {
    await this.request('/analytics/events', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  // Push notification endpoints
  async registerPushToken(token: string, topics?: string[]): Promise<void> {
    await this.request('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, topics }),
    });
  }

  async unregisterPushToken(): Promise<void> {
    await this.request('/push/unregister', {
      method: 'POST',
    });
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      await this.request('/health');
      return true;
    } catch {
      return false;
    }
  }
}