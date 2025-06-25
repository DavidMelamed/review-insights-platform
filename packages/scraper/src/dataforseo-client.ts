import { RateLimiter } from './rate-limiter';
import { retry } from './retry';
import { logger } from './logger';

export interface DataForSEOConfig {
  login: string;
  password: string;
  baseUrl?: string;
  maxRetries?: number;
  rateLimitPerMinute?: number;
}

export interface ReviewData {
  reviewId: string;
  author: string;
  rating: number;
  title?: string;
  content: string;
  date: Date;
  verified: boolean;
  helpful?: number;
  source: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface BusinessReviewsRequest {
  businessName: string;
  location?: string;
  language?: string;
  depth?: number;
  includeCompetitors?: boolean;
}

export interface CompetitorData {
  name: string;
  category: string;
  reviewCount: number;
  averageRating: number;
  location?: string;
}

export class DataForSEOClient {
  private config: Required<DataForSEOConfig>;
  private rateLimiter: RateLimiter;
  private authHeader: string;

  constructor(config: DataForSEOConfig) {
    this.config = {
      baseUrl: 'https://api.dataforseo.com/v3',
      maxRetries: 3,
      rateLimitPerMinute: 60,
      ...config,
    };

    this.rateLimiter = new RateLimiter(this.config.rateLimitPerMinute);
    this.authHeader = 'Basic ' + Buffer.from(`${config.login}:${config.password}`).toString('base64');
  }

  async getBusinessReviews(request: BusinessReviewsRequest): Promise<ReviewData[]> {
    await this.rateLimiter.acquire();

    const endpoint = `${this.config.baseUrl}/business_data/google/reviews/task_post`;
    
    const taskData = {
      location_name: request.location || 'United States',
      language_name: request.language || 'English',
      keyword: request.businessName,
      depth: request.depth || 100,
    };

    try {
      // Post the task
      const taskResponse = await retry(
        () => this.makeRequest('POST', endpoint, [taskData]),
        this.config.maxRetries
      );

      if (!taskResponse.tasks?.[0]?.id) {
        throw new Error('Failed to create review collection task');
      }

      const taskId = taskResponse.tasks[0].id;
      
      // Wait for task completion and get results
      const reviews = await this.waitForTaskCompletion(taskId);
      
      return this.parseReviews(reviews, request.businessName);
    } catch (error) {
      logger.error('Failed to fetch business reviews', { error, request });
      throw error;
    }
  }

  async discoverCompetitors(businessName: string, location?: string): Promise<CompetitorData[]> {
    await this.rateLimiter.acquire();

    const endpoint = `${this.config.baseUrl}/business_data/google/my_business_info/task_post`;
    
    const taskData = {
      location_name: location || 'United States',
      language_name: 'English',
      keyword: businessName,
    };

    try {
      const response = await retry(
        () => this.makeRequest('POST', endpoint, [taskData]),
        this.config.maxRetries
      );

      const taskId = response.tasks?.[0]?.id;
      if (!taskId) {
        throw new Error('Failed to create competitor discovery task');
      }

      const results = await this.waitForTaskCompletion(taskId);
      return this.parseCompetitors(results);
    } catch (error) {
      logger.error('Failed to discover competitors', { error, businessName });
      throw error;
    }
  }

  private async makeRequest(method: string, url: string, data?: any): Promise<any> {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private async waitForTaskCompletion(taskId: string, maxWaitTime = 60000): Promise<any> {
    const startTime = Date.now();
    const checkInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      await this.rateLimiter.acquire();
      
      const statusEndpoint = `${this.config.baseUrl}/business_data/google/reviews/task_get/${taskId}`;
      const response = await this.makeRequest('GET', statusEndpoint);

      if (response.tasks?.[0]?.status_message === 'Ok') {
        return response.tasks[0].result;
      }

      if (response.tasks?.[0]?.status_message === 'Error') {
        throw new Error(`Task failed: ${response.tasks[0].status_message}`);
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('Task timeout: Review collection took too long');
  }

  private parseReviews(rawData: any, source: string): ReviewData[] {
    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }

    return rawData.map((item: any) => ({
      reviewId: item.review_id || this.generateReviewId(),
      author: item.profile_name || 'Anonymous',
      rating: item.rating?.value || 0,
      title: item.title,
      content: item.review_text || '',
      date: new Date(item.timestamp || Date.now()),
      verified: item.verified || false,
      helpful: item.helpful_votes,
      source: source,
      url: item.review_url,
      metadata: {
        images: item.images,
        responseFromOwner: item.response_from_owner,
        profilePhoto: item.profile_photo_url,
      },
    }));
  }

  private parseCompetitors(rawData: any): CompetitorData[] {
    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }

    return rawData
      .filter((item: any) => item.type === 'local_pack')
      .map((item: any) => ({
        name: item.title || '',
        category: item.category || '',
        reviewCount: item.reviews_count || 0,
        averageRating: item.rating?.value || 0,
        location: item.address,
      }));
  }

  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}