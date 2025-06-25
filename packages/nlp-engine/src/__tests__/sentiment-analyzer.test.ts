import { describe, it, expect, beforeEach } from '@jest/globals';
import { SentimentAnalyzer } from '../sentiment-analyzer';
import { ReviewData } from '../../../scraper/src/dataforseo-client';

describe('SentimentAnalyzer', () => {
  let analyzer: SentimentAnalyzer;

  beforeEach(() => {
    analyzer = new SentimentAnalyzer();
  });

  describe('analyzeSentiment', () => {
    it('should detect positive sentiment', () => {
      const result = analyzer.analyzeSentiment('This product is excellent and amazing! I love it.');
      
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect negative sentiment', () => {
      const result = analyzer.analyzeSentiment('Terrible service, awful experience. Very disappointed.');
      
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    it('should detect neutral sentiment', () => {
      const result = analyzer.analyzeSentiment('The product was delivered on time.');
      
      expect(result.label).toBe('neutral');
      expect(Math.abs(result.score)).toBeLessThan(0.2);
    });

    it('should detect mixed sentiment', () => {
      const result = analyzer.analyzeSentiment('The food was excellent but the service was terrible.');
      
      expect(result.label).toBe('mixed');
      expect(result.magnitude).toBeGreaterThan(0.1);
    });

    it('should handle negation correctly', () => {
      const result = analyzer.analyzeSentiment('This is not good at all.');
      
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });
  });

  describe('detectComplaints', () => {
    it('should detect quality complaints', () => {
      const result = analyzer.detectComplaints('The product arrived broken and defective.');
      
      expect(result.isComplaint).toBe(true);
      expect(result.category).toBe('quality');
      expect(result.severity).toBe('high');
      expect(result.keywords).toContain('broken');
      expect(result.suggestedAction).toContain('replacement');
    });

    it('should detect service complaints', () => {
      const result = analyzer.detectComplaints('The delivery was extremely slow and delayed.');
      
      expect(result.isComplaint).toBe(true);
      expect(result.category).toBe('service');
      expect(result.severity).toBe('medium');
    });

    it('should detect staff complaints', () => {
      const result = analyzer.detectComplaints('The staff was rude and unprofessional.');
      
      expect(result.isComplaint).toBe(true);
      expect(result.category).toBe('staff');
      expect(result.severity).toBe('high');
      expect(result.suggestedAction).toContain('staff behavior');
    });

    it('should not detect complaints in positive reviews', () => {
      const result = analyzer.detectComplaints('Everything was perfect! Great experience.');
      
      expect(result.isComplaint).toBe(false);
    });
  });

  describe('detectFeatureRequests', () => {
    it('should detect feature requests with "would be nice"', () => {
      const result = analyzer.detectFeatureRequests('It would be nice if the app had dark mode.');
      
      expect(result.isFeatureRequest).toBe(true);
      expect(result.feature).toContain('dark mode');
      expect(result.priority).toBe('medium');
    });

    it('should detect feature requests with "wish"', () => {
      const result = analyzer.detectFeatureRequests('I wish they had a mobile app for easier access.');
      
      expect(result.isFeatureRequest).toBe(true);
      expect(result.feature).toContain('mobile app');
    });

    it('should detect high priority requests', () => {
      const result = analyzer.detectFeatureRequests('This feature is essential: we need API access.');
      
      expect(result.isFeatureRequest).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should not detect feature requests in regular feedback', () => {
      const result = analyzer.detectFeatureRequests('The current features work well.');
      
      expect(result.isFeatureRequest).toBe(false);
    });
  });

  describe('analyzeAspects', () => {
    const mockReviews: ReviewData[] = [
      {
        reviewId: '1',
        author: 'User1',
        rating: 5,
        content: 'Great service and friendly staff. The atmosphere was wonderful.',
        date: new Date(),
        verified: true,
        source: 'Google',
      },
      {
        reviewId: '2',
        author: 'User2',
        rating: 2,
        content: 'Poor service, long wait time. The price was too expensive.',
        date: new Date(),
        verified: true,
        source: 'Yelp',
      },
      {
        reviewId: '3',
        author: 'User3',
        rating: 4,
        content: 'Good quality product, reasonable price. Quick delivery.',
        date: new Date(),
        verified: true,
        source: 'Google',
      },
    ];

    it('should identify and analyze multiple aspects', () => {
      const aspects = analyzer.analyzeAspects(mockReviews);
      
      expect(aspects.length).toBeGreaterThan(0);
      
      const serviceAspect = aspects.find(a => a.aspect === 'service');
      expect(serviceAspect).toBeDefined();
      expect(serviceAspect!.mentions).toBe(2);
      
      const priceAspect = aspects.find(a => a.aspect === 'price');
      expect(priceAspect).toBeDefined();
    });

    it('should calculate aspect sentiment correctly', () => {
      const aspects = analyzer.analyzeAspects(mockReviews);
      
      const serviceAspect = aspects.find(a => a.aspect === 'service');
      // Mixed sentiment: one positive, one negative
      expect(serviceAspect!.sentiment.label).toBeDefined();
    });

    it('should provide examples for each aspect', () => {
      const aspects = analyzer.analyzeAspects(mockReviews);
      
      aspects.forEach(aspect => {
        expect(aspect.examples.length).toBeGreaterThan(0);
        expect(aspect.examples[0]).toContain('...');
      });
    });

    it('should sort aspects by mention frequency', () => {
      const aspects = analyzer.analyzeAspects(mockReviews);
      
      for (let i = 1; i < aspects.length; i++) {
        expect(aspects[i - 1].mentions).toBeGreaterThanOrEqual(aspects[i].mentions);
      }
    });
  });

  describe('analyzeReviewBatch', () => {
    const mockReviews: ReviewData[] = [
      {
        reviewId: '1',
        author: 'User1',
        rating: 5,
        content: 'Excellent product! Would be nice if it had bluetooth connectivity.',
        date: new Date(),
        verified: true,
        source: 'Amazon',
      },
      {
        reviewId: '2',
        author: 'User2',
        rating: 1,
        content: 'Product arrived broken. Very disappointed with the quality.',
        date: new Date(),
        verified: true,
        source: 'Amazon',
      },
      {
        reviewId: '3',
        author: 'User3',
        rating: 4,
        content: 'Good value for money. I wish they had more color options.',
        date: new Date(),
        verified: true,
        source: 'Website',
      },
    ];

    it('should provide comprehensive analysis', () => {
      const result = analyzer.analyzeReviewBatch(mockReviews);
      
      expect(result.overallSentiment).toBeDefined();
      expect(result.aspectSentiments).toBeInstanceOf(Array);
      expect(result.complaints).toBeInstanceOf(Array);
      expect(result.featureRequests).toBeInstanceOf(Array);
    });

    it('should calculate overall sentiment from all reviews', () => {
      const result = analyzer.analyzeReviewBatch(mockReviews);
      
      // With ratings 5, 1, 4 - should be slightly positive
      expect(result.overallSentiment.score).toBeGreaterThan(-0.5);
      expect(result.overallSentiment.score).toBeLessThan(0.5);
    });

    it('should detect all complaints', () => {
      const result = analyzer.analyzeReviewBatch(mockReviews);
      
      expect(result.complaints.length).toBeGreaterThan(0);
      
      const qualityComplaint = result.complaints.find(c => c.category === 'quality');
      expect(qualityComplaint).toBeDefined();
      expect(qualityComplaint!.keywords).toContain('broken');
    });

    it('should aggregate feature requests', () => {
      const result = analyzer.analyzeReviewBatch(mockReviews);
      
      expect(result.featureRequests.length).toBeGreaterThan(0);
      
      // Should find bluetooth and color options
      const bluetoothRequest = result.featureRequests.find(f => 
        f.feature.toLowerCase().includes('bluetooth')
      );
      expect(bluetoothRequest).toBeDefined();
    });

    it('should handle empty review batch', () => {
      const result = analyzer.analyzeReviewBatch([]);
      
      expect(result.overallSentiment.label).toBe('neutral');
      expect(result.aspectSentiments).toHaveLength(0);
      expect(result.complaints).toHaveLength(0);
      expect(result.featureRequests).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const sentiment = analyzer.analyzeSentiment('');
      expect(sentiment.label).toBe('neutral');
      expect(sentiment.score).toBe(0);
    });

    it('should handle very long text', () => {
      const longText = 'Great product. '.repeat(1000);
      const sentiment = analyzer.analyzeSentiment(longText);
      
      expect(sentiment).toBeDefined();
      expect(sentiment.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle special characters and emojis', () => {
      const sentiment = analyzer.analyzeSentiment('Amazing!!! 😍 Love it! 💯');
      
      expect(sentiment.label).toBe('positive');
    });

    it('should handle multiple languages gracefully', () => {
      // Should still work even if not optimized for other languages
      const sentiment = analyzer.analyzeSentiment('Très bien! Excellent product.');
      
      expect(sentiment).toBeDefined();
    });
  });
});