import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PredictiveAnalyticsService } from '../predictive-analytics.service';
import { prisma } from '../../database';

// Mock prisma
jest.mock('../../database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
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

describe('PredictiveAnalyticsService', () => {
  let service: PredictiveAnalyticsService;
  
  beforeEach(() => {
    service = new PredictiveAnalyticsService();
    jest.clearAllMocks();
  });

  describe('predictCustomerChurn', () => {
    it('should predict high churn risk for customer with declining metrics', async () => {
      const mockCustomer = {
        id: 'user_123',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months old
        subscription: {
          plan: 'PROFESSIONAL',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        collections: [
          {
            reviews: [
              {
                date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                sentimentScore: 0.8,
                content: 'Great service!',
              },
              {
                date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                sentimentScore: 0.5,
                content: 'Service is okay',
              },
              {
                date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                sentimentScore: 0.2,
                content: 'Getting worse',
              },
              {
                date: new Date(),
                sentimentScore: -0.3,
                content: 'Disappointed with recent changes',
              },
            ],
          },
        ],
        usageRecords: Array.from({ length: 10 }, (_, i) => ({
          createdAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
          action: 'report_generated',
        })).slice(0, 5), // Reduced usage in recent weeks
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockCustomer);

      const prediction = await service.predictCustomerChurn('user_123');

      expect(prediction.userId).toBe('user_123');
      expect(prediction.probability).toBeGreaterThan(0.5);
      expect(prediction.riskLevel).toMatch(/high|critical/);
      expect(prediction.factors).toContainEqual(
        expect.objectContaining({
          name: 'Declining Sentiment',
          impact: expect.any(Number),
        })
      );
      expect(prediction.recommendedActions).toContain(
        'Schedule customer success call to address concerns'
      );
    });

    it('should predict low churn risk for engaged customer', async () => {
      const mockCustomer = {
        id: 'user_456',
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        subscription: {
          plan: 'PROFESSIONAL',
          currentPeriodEnd: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
        collections: [
          {
            reviews: Array.from({ length: 20 }, (_, i) => ({
              date: new Date(Date.now() - i * 5 * 24 * 60 * 60 * 1000),
              sentimentScore: 0.7 + Math.random() * 0.2,
              content: 'Consistently positive feedback',
            })),
          },
        ],
        usageRecords: Array.from({ length: 50 }, (_, i) => ({
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          action: 'report_generated',
        })),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockCustomer);

      const prediction = await service.predictCustomerChurn('user_456');

      expect(prediction.probability).toBeLessThan(0.3);
      expect(prediction.riskLevel).toBe('low');
      expect(prediction.factors.length).toBeGreaterThan(0);
    });
  });

  describe('forecastSentimentTrend', () => {
    it('should forecast sentiment trends with seasonality', async () => {
      // Generate historical data with weekly pattern
      const historicalReviews = Array.from({ length: 90 }, (_, i) => {
        const date = new Date(Date.now() - (90 - i) * 24 * 60 * 60 * 1000);
        const dayOfWeek = date.getDay();
        // Higher sentiment on weekends
        const baseSentiment = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 0.5;
        const noise = (Math.random() - 0.5) * 0.2;
        
        return {
          date,
          sentimentScore: baseSentiment + noise,
        };
      });

      (prisma.review.findMany as jest.Mock).mockResolvedValue(historicalReviews);

      const forecast = await service.forecastSentimentTrend('business_123', 14);

      expect(forecast.metric).toBe('sentiment_score');
      expect(forecast.predictions).toHaveLength(14);
      expect(forecast.seasonality).toBeDefined();
      expect(forecast.seasonality?.type).toBe('weekly');
      expect(forecast.confidence).toBeGreaterThan(0);
      
      // Check predictions have proper structure
      forecast.predictions.forEach(prediction => {
        expect(prediction).toHaveProperty('date');
        expect(prediction).toHaveProperty('value');
        expect(prediction).toHaveProperty('upperBound');
        expect(prediction).toHaveProperty('lowerBound');
        expect(prediction.upperBound).toBeGreaterThan(prediction.value);
        expect(prediction.lowerBound).toBeLessThan(prediction.value);
      });
    });

    it('should detect anomalies in historical data', async () => {
      const historicalReviews = [
        ...Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (35 - i) * 24 * 60 * 60 * 1000),
          sentimentScore: 0.6 + (Math.random() - 0.5) * 0.1,
        })),
        // Add anomaly
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          sentimentScore: -0.8, // Sudden negative spike
        },
        ...Array.from({ length: 4 }, (_, i) => ({
          date: new Date(Date.now() - (4 - i) * 24 * 60 * 60 * 1000),
          sentimentScore: 0.6 + (Math.random() - 0.5) * 0.1,
        })),
      ];

      (prisma.review.findMany as jest.Mock).mockResolvedValue(historicalReviews);

      const forecast = await service.forecastSentimentTrend('business_123');

      expect(forecast.anomalies).toHaveLength(1);
      expect(forecast.anomalies[0].severity).toBe('high');
      expect(forecast.anomalies[0].actual).toBe(-0.8);
      expect(forecast.anomalies[0].possibleCauses).toContain('Sudden change in sentiment');
    });
  });

  describe('calculateRevenueImpact', () => {
    it('should calculate revenue impact based on sentiment change', async () => {
      const sentimentChange = 0.2; // 20% improvement
      const impact = await service.calculateRevenueImpact('business_123', sentimentChange);

      expect(impact.sentimentChange).toBe(0.2);
      expect(impact.estimatedRevenueChange).toBeGreaterThan(0);
      expect(impact.confidence).toBeGreaterThan(0);
      expect(impact.timeframe).toBe('3-6 months');
      expect(impact.breakdown.retentionImpact).toBeGreaterThan(0);
      expect(impact.breakdown.acquisitionImpact).toBeGreaterThan(0);
      expect(impact.breakdown.upsellImpact).toBeGreaterThan(0);
      
      // Retention should be the largest component
      expect(impact.breakdown.retentionImpact).toBeGreaterThan(impact.breakdown.acquisitionImpact);
      expect(impact.breakdown.retentionImpact).toBeGreaterThan(impact.breakdown.upsellImpact);
    });

    it('should calculate negative impact for sentiment decline', async () => {
      const sentimentChange = -0.15; // 15% decline
      const impact = await service.calculateRevenueImpact('business_123', sentimentChange);

      expect(impact.estimatedRevenueChange).toBeLessThan(0);
      expect(impact.breakdown.retentionImpact).toBeLessThan(0);
    });
  });
});