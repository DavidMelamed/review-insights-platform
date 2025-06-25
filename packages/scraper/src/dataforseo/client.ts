import { z } from 'zod';
import { Review, ReviewSchema } from '../index.js';
import { RateLimiter } from './rate-limiter.js';
import { withRetry, isRetryableError } from './retry.js';
import {
  DataForSEOConfig,
  DataForSEOTaskPost,
  DataForSEOResponse,
  DataForSEOTaskResult,
  DataForSEOReview,
  Platform,
  PlatformEndpoints,
} from './types.js';
import {
  parseDataForSEOError,
  AuthenticationError,
  ValidationError,
  TimeoutError,
} from './errors.js';

export class DataForSEOClient {
  private config: Required<DataForSEOConfig>;
  private rateLimiter: RateLimiter;
  private authHeader: string;
  
  private readonly platformEndpoints: PlatformEndpoints = {
    google: {
      reviews: '/v3/business_data/google/reviews/task_post',
      taskGet: '/v3/business_data/google/reviews/task_get',
    },
    yelp: {
      reviews: '/v3/business_data/yelp/reviews/task_post',
      taskGet: '/v3/business_data/yelp/reviews/task_get',
    },
    trustpilot: {
      reviews: '/v3/business_data/trustpilot/reviews/task_post',
      taskGet: '/v3/business_data/trustpilot/reviews/task_get',
    },
    tripadvisor: {
      reviews: '/v3/business_data/tripadvisor/reviews/task_post',
      taskGet: '/v3/business_data/tripadvisor/reviews/task_get',
    },
  };

  constructor(config: DataForSEOConfig) {
    this.config = {
      email: config.email,
      password: config.password,
      baseUrl: config.baseUrl ?? 'https://api.dataforseo.com',
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      rateLimit: {
        maxConcurrent: config.rateLimit?.maxConcurrent ?? 2,
        minTime: config.rateLimit?.minTime ?? 1000,
      },
    };

    this.authHeader = `Basic ${Buffer.from(`${this.config.email}:${this.config.password}`).toString('base64')}`;
    
    this.rateLimiter = new RateLimiter({
      maxConcurrent: this.config.rateLimit.maxConcurrent,
      minTime: this.config.rateLimit.minTime,
      timeout: this.config.timeout,
    });
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: any
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    return this.rateLimiter.execute(async () => {
      return withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

          try {
            const response = await fetch(url, {
              method,
              headers: {
                'Authorization': this.authHeader,
                'Content-Type': 'application/json',
              },
              body: body ? JSON.stringify(body) : undefined,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              let errorData;
              try {
                errorData = await response.json();
              } catch {
                errorData = { message: response.statusText };
              }
              
              const error = parseDataForSEOError({
                status: response.status,
                message: errorData.message || errorData.status_message || response.statusText,
                ...errorData,
              });
              
              if (isRetryableError(error)) {
                throw error;
              }
              
              throw error;
            }

            return response.json();
          } catch (error) {
            clearTimeout(timeoutId);
            
            if (error instanceof Error && error.name === 'AbortError') {
              throw new TimeoutError(`Request timeout after ${this.config.timeout}ms`);
            }
            
            throw parseDataForSEOError(error);
          }
        },
        {
          maxRetries: this.config.maxRetries,
          onRetry: (error, attempt) => {
            console.warn(`Retrying request to ${endpoint} (attempt ${attempt}):`, error.message);
          },
        }
      );
    });
  }

  async createReviewTask(
    platform: Platform,
    params: DataForSEOTaskPost
  ): Promise<string> {
    const endpoint = this.platformEndpoints[platform]?.reviews;
    if (!endpoint) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const response = await this.makeRequest<DataForSEOResponse<any>>(
      endpoint,
      'POST',
      [params]
    );

    if (response.tasks_error > 0 || !response.tasks[0]?.id) {
      throw new Error(
        response.tasks[0]?.status_message || 'Failed to create review task'
      );
    }

    return response.tasks[0].id;
  }

  async getTaskResult(
    platform: Platform,
    taskId: string
  ): Promise<DataForSEOTaskResult | null> {
    const endpoint = this.platformEndpoints[platform]?.taskGet;
    if (!endpoint) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const response = await this.makeRequest<DataForSEOResponse<DataForSEOTaskResult>>(
      `${endpoint}/${taskId}`,
      'GET'
    );

    if (response.tasks_error > 0) {
      throw new Error(
        response.tasks[0]?.status_message || 'Failed to get task result'
      );
    }

    const task = response.tasks[0];
    
    // Task is still processing
    if (task.status_code === 20100) {
      return null;
    }

    return task;
  }

  async waitForTaskCompletion(
    platform: Platform,
    taskId: string,
    maxWaitTime = 300000, // 5 minutes
    pollInterval = 5000 // 5 seconds
  ): Promise<DataForSEOTaskResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getTaskResult(platform, taskId);
      
      if (result) {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Task ${taskId} did not complete within ${maxWaitTime}ms`);
  }

  private convertDataForSEOReview(
    platform: Platform,
    review: DataForSEOReview
  ): Review {
    return {
      id: review.review_id,
      platform,
      author: review.author_name,
      rating: review.review_rating || review.rating.value,
      title: review.review_text.split('\n')[0].substring(0, 100),
      content: review.review_text,
      date: new Date(review.datetime),
      verified: false, // DataForSEO doesn't provide verification status
      helpfulCount: review.review_helpful_count || 0,
      images: review.review_images || [],
      metadata: {
        authorId: review.author_id,
        authorUrl: review.author_url,
        authorImage: review.author_image_url,
        reviewUrl: review.review_url,
        language: review.language,
        isLocalGuide: review.is_local_guide,
        profilePhotosCount: review.profile_photos_count,
        reviewsCount: review.reviews_count,
        ownerAnswer: review.owner_answer,
        ownerDateTime: review.owner_datetime,
      },
    };
  }

  async fetchReviews(
    platform: Platform,
    params: DataForSEOTaskPost
  ): Promise<Review[]> {
    // Create task
    const taskId = await this.createReviewTask(platform, params);
    
    // Wait for completion
    const result = await this.waitForTaskCompletion(platform, taskId);
    
    if (!result.result?.[0]?.items) {
      return [];
    }

    // Convert reviews to our format
    const reviews = result.result[0].items.map(review =>
      this.convertDataForSEOReview(platform, review)
    );

    // Validate reviews
    return reviews.filter(review => {
      try {
        ReviewSchema.parse(review);
        return true;
      } catch (error) {
        console.warn('Invalid review data:', error);
        return false;
      }
    });
  }

  async fetchAllReviews(
    platform: Platform,
    keyword: string,
    options: {
      location?: string;
      maxDepth?: number;
      ratingFilter?: number[];
      sortBy?: 'newest' | 'highest_rating' | 'lowest_rating' | 'most_relevant';
    } = {}
  ): Promise<Review[]> {
    const allReviews: Review[] = [];
    const depth = options.maxDepth ?? 100;
    
    const params: DataForSEOTaskPost = {
      keyword,
      location_name: options.location,
      depth,
      rating_filter: options.ratingFilter,
      sort_by: options.sortBy ?? 'newest',
    };

    const reviews = await this.fetchReviews(platform, params);
    allReviews.push(...reviews);

    return allReviews;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest<any>(
        '/v3/appendix/user_data',
        'GET'
      );
      return response.status_code === 20000;
    } catch (error) {
      return false;
    }
  }
}