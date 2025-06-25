import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { IndustryBenchmarkService } from '../industry-benchmark.service';
import { prisma } from '../../database';

// Mock prisma
jest.mock('../../database', () => ({
  prisma: {
    review: {
      findMany: jest.fn(),
    },
    usageRecord: {
      create: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('IndustryBenchmarkService', () => {
  let service: IndustryBenchmarkService;
  
  beforeEach(() => {
    service = new IndustryBenchmarkService();
    jest.clearAllMocks();
  });

  describe('generateBenchmark', () => {
    it('should generate comprehensive benchmark for restaurant business', async () => {
      // Mock review data for a well-performing restaurant
      const mockReviews = Array.from({ length: 100 }, (_, i) => ({
        rating: 4 + Math.random() * 0.8, // 4.0-4.8 rating
        date: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000),
        sentimentScore: 0.5 + Math.random() * 0.3,
        content: 'Great food and service!',
      }));

      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const benchmark = await service.generateBenchmark('business_123', 'Restaurant', 'North America');

      expect(benchmark).toMatchObject({
        industry: 'Restaurant',
        region: 'North America',
        metrics: expect.objectContaining({
          averageRating: expect.any(Number),
          reviewVolume: expect.objectContaining({
            monthly: expect.any(Number),
            growth: expect.any(Number),
          }),
          responseRate: expect.any(Number),
          sentimentScore: expect.objectContaining({
            average: expect.any(Number),
            distribution: expect.objectContaining({
              positive: expect.any(Number),
              neutral: expect.any(Number),
              negative: expect.any(Number),
            }),
          }),
        }),
        percentileRanking: expect.objectContaining({
          overall: expect.any(Number),
          rating: expect.any(Number),
          volume: expect.any(Number),
          responseRate: expect.any(Number),
          sentiment: expect.any(Number),
        }),
        competitorComparison: expect.arrayContaining([
          expect.objectContaining({
            competitorId: expect.any(String),
            name: expect.any(String),
            metrics: expect.any(Object),
            relativePerformance: expect.any(Object),
            strengths: expect.any(Array),
            weaknesses: expect.any(Array),
          }),
        ]),
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/strength|weakness|opportunity|threat/),
            title: expect.any(String),
            description: expect.any(String),
            impact: expect.stringMatching(/low|medium|high/),
            recommendation: expect.any(String),
          }),
        ]),
      });
    });

    it('should identify weaknesses for underperforming business', async () => {
      // Mock review data for struggling business
      const mockReviews = Array.from({ length: 30 }, (_, i) => ({
        rating: 2.5 + Math.random() * 1, // 2.5-3.5 rating
        date: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
        sentimentScore: -0.3 + Math.random() * 0.4,
        content: 'Needs improvement',
      }));

      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const benchmark = await service.generateBenchmark('business_456', 'Restaurant');

      // Should have weakness insights
      const weaknesses = benchmark.insights.filter(i => i.type === 'weakness');
      expect(weaknesses.length).toBeGreaterThan(0);
      
      // Should recommend improvements
      const ratingWeakness = weaknesses.find(w => w.title.includes('Rating'));
      expect(ratingWeakness).toBeDefined();
      expect(ratingWeakness?.impact).toBe('high');
      expect(ratingWeakness?.potentialImprovement).toBeGreaterThan(0);
    });

    it('should calculate accurate percentile rankings', async () => {
      // Mock excellent performance data
      const mockReviews = Array.from({ length: 200 }, (_, i) => ({
        rating: 4.7 + Math.random() * 0.2, // 4.7-4.9 rating
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        sentimentScore: 0.7 + Math.random() * 0.2,
        content: 'Excellent!',
      }));

      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const benchmark = await service.generateBenchmark('business_789', 'Hotel');

      // Should rank in high percentiles
      expect(benchmark.percentileRanking.rating).toBeGreaterThan(80);
      expect(benchmark.percentileRanking.sentiment).toBeGreaterThan(80);
      expect(benchmark.percentileRanking.overall).toBeGreaterThan(70);
    });

    it('should provide competitor comparisons', async () => {
      const mockReviews = Array.from({ length: 50 }, () => ({
        rating: 4.2,
        date: new Date(),
        sentimentScore: 0.5,
        content: 'Good service',
      }));

      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const benchmark = await service.generateBenchmark('business_123', 'E-commerce');

      expect(benchmark.competitorComparison).toHaveLength(3);
      
      const marketLeader = benchmark.competitorComparison.find(c => c.name === 'Market Leader');
      expect(marketLeader).toBeDefined();
      expect(marketLeader?.metrics.rating).toBeGreaterThan(4.5);
      
      // Check relative performance calculations
      benchmark.competitorComparison.forEach(competitor => {
        expect(competitor.relativePerformance).toHaveProperty('rating');
        expect(competitor.relativePerformance).toHaveProperty('volume');
        expect(competitor.relativePerformance).toHaveProperty('sentiment');
      });
    });
  });

  describe('getIndustryTrends', () => {
    it('should return trends for known industries', async () => {
      const restaurantTrends = await service.getIndustryTrends('Restaurant');
      expect(restaurantTrends).toContain('contactless ordering');
      expect(restaurantTrends).toContain('delivery experience');
      expect(restaurantTrends).toContain('dietary options');

      const saasaTrends = await service.getIndustryTrends('SaaS');
      expect(saasaTrends).toContain('AI integration');
      expect(saasaTrends).toContain('no-code features');
      expect(saasaTrends).toContain('integrations');
    });

    it('should return empty array for unknown industry', async () => {
      const trends = await service.getIndustryTrends('UnknownIndustry');
      expect(trends).toEqual([]);
    });
  });

  describe('getIndustryKPIs', () => {
    it('should return KPIs for known industries', async () => {
      const restaurantKPIs = await service.getIndustryKPIs('Restaurant');
      expect(restaurantKPIs).toMatchObject({
        minAcceptableRating: 3.5,
        targetRating: 4.2,
        excellentRating: 4.6,
        minResponseRate: 0.3,
        targetResponseTime: 24,
        minMonthlyReviews: 20,
      });

      const healthcareKPIs = await service.getIndustryKPIs('Healthcare');
      expect(healthcareKPIs.minAcceptableRating).toBeGreaterThan(restaurantKPIs.minAcceptableRating);
    });
  });

  describe('getCriticalAspects', () => {
    it('should return critical aspects for industries', async () => {
      const hotelAspects = await service.getCriticalAspects('Hotel');
      expect(hotelAspects).toContain('cleanliness');
      expect(hotelAspects).toContain('comfort');
      expect(hotelAspects).toContain('location');
      expect(hotelAspects).toContain('service');
      expect(hotelAspects).toContain('value');

      const ecommerceAspects = await service.getCriticalAspects('E-commerce');
      expect(ecommerceAspects).toContain('product quality');
      expect(ecommerceAspects).toContain('shipping');
      expect(ecommerceAspects).toContain('customer service');
    });
  });

  describe('regional adjustments', () => {
    it('should apply regional adjustments to metrics', async () => {
      const mockReviews = Array.from({ length: 50 }, () => ({
        rating: 4.0,
        date: new Date(),
        sentimentScore: 0.5,
        content: 'Good',
      }));

      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      // Compare same business in different regions
      const northAmericaBenchmark = await service.generateBenchmark('business_123', 'Restaurant', 'North America');
      const asiaBenchmark = await service.generateBenchmark('business_123', 'Restaurant', 'Asia');
      
      // Asia should have higher volume expectations
      expect(asiaBenchmark.metrics.reviewVolume.monthly).toBeGreaterThan(
        northAmericaBenchmark.metrics.reviewVolume.monthly
      );
    });
  });

  describe('insight generation', () => {
    it('should prioritize insights by impact', async () => {
      const mockReviews = Array.from({ length: 20 }, () => ({
        rating: 3.0, // Below minimum acceptable
        date: new Date(),
        sentimentScore: -0.5,
        content: 'Poor experience',
      }));

      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const benchmark = await service.generateBenchmark('business_123', 'Restaurant');

      // Insights should be sorted by impact
      const impactLevels = benchmark.insights.map(i => i.impact);
      const impactOrder = { high: 3, medium: 2, low: 1 };
      
      for (let i = 1; i < impactLevels.length; i++) {
        expect(impactOrder[impactLevels[i - 1]]).toBeGreaterThanOrEqual(
          impactOrder[impactLevels[i]]
        );
      }
    });

    it('should provide actionable recommendations', async () => {
      const mockReviews = Array.from({ length: 10 }, () => ({
        rating: 4.0,
        date: new Date(),
        sentimentScore: 0.3,
        content: 'Okay',
      }));

      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const benchmark = await service.generateBenchmark('business_123', 'Restaurant');

      // All insights should have recommendations
      benchmark.insights.forEach(insight => {
        expect(insight.recommendation).toBeTruthy();
        expect(insight.recommendation.length).toBeGreaterThan(10);
      });
    });
  });
});