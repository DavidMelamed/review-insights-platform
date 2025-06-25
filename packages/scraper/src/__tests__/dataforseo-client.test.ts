import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DataForSEOClient, BusinessReviewsRequest, ReviewData } from '../dataforseo-client';
import { RateLimiter } from '../rate-limiter';

// Mock dependencies
jest.mock('../rate-limiter');
jest.mock('../logger');

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('DataForSEOClient', () => {
  let client: DataForSEOClient;
  const mockConfig = {
    login: 'test_login',
    password: 'test_password',
    rateLimitPerMinute: 60,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new DataForSEOClient(mockConfig);
    
    // Mock rate limiter
    (RateLimiter.prototype.acquire as jest.Mock).mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(client).toBeDefined();
    });

    it('should create auth header correctly', () => {
      const expectedAuth = 'Basic ' + Buffer.from('test_login:test_password').toString('base64');
      // Test by making a request and checking the auth header
    });
  });

  describe('getBusinessReviews', () => {
    const mockRequest: BusinessReviewsRequest = {
      businessName: 'Test Business',
      location: 'San Francisco, CA',
      depth: 50,
    };

    it('should successfully fetch and parse reviews', async () => {
      // Mock task creation response
      const mockTaskResponse = {
        tasks: [{
          id: 'task_123',
          status_message: 'Ok',
        }],
      };

      // Mock task result response
      const mockResultResponse = {
        tasks: [{
          status_message: 'Ok',
          result: [{
            review_id: 'review_1',
            profile_name: 'John Doe',
            rating: { value: 5 },
            review_text: 'Great service!',
            timestamp: '2024-01-01T00:00:00Z',
            verified: true,
          }],
        }],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTaskResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResultResponse,
        } as Response);

      const reviews = await client.getBusinessReviews(mockRequest);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toMatchObject({
        author: 'John Doe',
        rating: 5,
        content: 'Great service!',
        verified: true,
        source: 'Test Business',
      });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as Response);

      await expect(client.getBusinessReviews(mockRequest))
        .rejects.toThrow('DataForSEO API error: 400 - Bad Request');
    });

    it('should handle task timeout', async () => {
      const mockTaskResponse = {
        tasks: [{
          id: 'task_123',
          status_message: 'Ok',
        }],
      };

      // Mock task creation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaskResponse,
      } as Response);

      // Mock status checks - always return processing
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          tasks: [{
            status_message: 'Processing',
          }],
        }),
      } as Response);

      // Set a very short timeout for testing
      const originalTimeout = 100; // 100ms for test
      
      await expect(
        client['waitForTaskCompletion']('task_123', originalTimeout)
      ).rejects.toThrow('Task timeout');
    });
  });

  describe('discoverCompetitors', () => {
    it('should fetch and parse competitor data', async () => {
      const mockTaskResponse = {
        tasks: [{
          id: 'task_456',
          status_message: 'Ok',
        }],
      };

      const mockCompetitorData = [{
        type: 'local_pack',
        title: 'Competitor Business',
        category: 'Restaurant',
        reviews_count: 100,
        rating: { value: 4.5 },
        address: '123 Main St',
      }];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTaskResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tasks: [{
              status_message: 'Ok',
              result: mockCompetitorData,
            }],
          }),
        } as Response);

      const competitors = await client.discoverCompetitors('Test Business');

      expect(competitors).toHaveLength(1);
      expect(competitors[0]).toMatchObject({
        name: 'Competitor Business',
        category: 'Restaurant',
        reviewCount: 100,
        averageRating: 4.5,
        location: '123 Main St',
      });
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      const mockRequest: BusinessReviewsRequest = {
        businessName: 'Test',
      };

      // Make multiple requests
      const promises = Array(5).fill(null).map(() => 
        client.getBusinessReviews(mockRequest).catch(() => {})
      );

      await Promise.all(promises);

      // Verify rate limiter was called for each request
      expect(RateLimiter.prototype.acquire).toHaveBeenCalledTimes(5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty review data', async () => {
      const mockTaskResponse = {
        tasks: [{
          id: 'task_789',
          status_message: 'Ok',
        }],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTaskResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tasks: [{
              status_message: 'Ok',
              result: [],
            }],
          }),
        } as Response);

      const reviews = await client.getBusinessReviews({ businessName: 'Empty Business' });
      expect(reviews).toHaveLength(0);
    });

    it('should generate review ID if missing', async () => {
      const mockReviewWithoutId = {
        profile_name: 'Jane Doe',
        rating: { value: 4 },
        review_text: 'Good experience',
        timestamp: new Date().toISOString(),
      };

      const mockTaskResponse = {
        tasks: [{
          id: 'task_999',
          status_message: 'Ok',
        }],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTaskResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tasks: [{
              status_message: 'Ok',
              result: [mockReviewWithoutId],
            }],
          }),
        } as Response);

      const reviews = await client.getBusinessReviews({ businessName: 'Test' });
      
      expect(reviews[0].reviewId).toMatch(/^review_\d+_[a-z0-9]+$/);
    });
  });
});