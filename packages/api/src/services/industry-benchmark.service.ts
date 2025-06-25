import { prisma } from '../database';
import { logger } from '../utils/logger';

export interface IndustryBenchmark {
  industry: string;
  region?: string;
  metrics: BenchmarkMetrics;
  percentileRanking: PercentileRanking;
  competitorComparison: CompetitorComparison[];
  insights: BenchmarkInsight[];
  lastUpdated: Date;
}

export interface BenchmarkMetrics {
  averageRating: number;
  reviewVolume: {
    monthly: number;
    growth: number; // YoY percentage
  };
  responseRate: number;
  responseTime: {
    average: number; // hours
    median: number;
  };
  sentimentScore: {
    average: number;
    distribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  aspectScores: Record<string, number>;
  complaintsRate: number;
  featureRequestsRate: number;
}

export interface PercentileRanking {
  overall: number;
  rating: number;
  volume: number;
  responseRate: number;
  sentiment: number;
  aspectRankings: Record<string, number>;
}

export interface CompetitorComparison {
  competitorId: string;
  name: string;
  metrics: {
    rating: number;
    reviewCount: number;
    responseRate: number;
    sentimentScore: number;
  };
  relativePerformance: {
    rating: number; // % difference
    volume: number;
    sentiment: number;
  };
  strengths: string[];
  weaknesses: string[];
}

export interface BenchmarkInsight {
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  recommendation: string;
  potentialImprovement?: number; // % improvement possible
}

export interface IndustryStandards {
  [industry: string]: {
    kpis: {
      minAcceptableRating: number;
      targetRating: number;
      excellentRating: number;
      minResponseRate: number;
      targetResponseTime: number; // hours
      minMonthlyReviews: number;
    };
    criticalAspects: string[];
    commonComplaints: string[];
    emergingTrends: string[];
  };
}

export class IndustryBenchmarkService {
  // Industry-specific KPIs
  private industryStandards: IndustryStandards = {
    'Restaurant': {
      kpis: {
        minAcceptableRating: 3.5,
        targetRating: 4.2,
        excellentRating: 4.6,
        minResponseRate: 0.3,
        targetResponseTime: 24,
        minMonthlyReviews: 20,
      },
      criticalAspects: ['food quality', 'service', 'cleanliness', 'value', 'atmosphere'],
      commonComplaints: ['wait time', 'cold food', 'poor service', 'cleanliness issues'],
      emergingTrends: ['contactless ordering', 'delivery experience', 'dietary options'],
    },
    'Hotel': {
      kpis: {
        minAcceptableRating: 3.8,
        targetRating: 4.3,
        excellentRating: 4.7,
        minResponseRate: 0.6,
        targetResponseTime: 12,
        minMonthlyReviews: 30,
      },
      criticalAspects: ['cleanliness', 'comfort', 'location', 'service', 'value'],
      commonComplaints: ['cleanliness', 'noise', 'wifi', 'check-in process'],
      emergingTrends: ['contactless check-in', 'enhanced cleaning', 'work amenities'],
    },
    'E-commerce': {
      kpis: {
        minAcceptableRating: 3.7,
        targetRating: 4.4,
        excellentRating: 4.8,
        minResponseRate: 0.2,
        targetResponseTime: 48,
        minMonthlyReviews: 50,
      },
      criticalAspects: ['product quality', 'shipping', 'customer service', 'value', 'returns'],
      commonComplaints: ['shipping delays', 'product quality', 'return process', 'customer service'],
      emergingTrends: ['sustainability', 'same-day delivery', 'personalization'],
    },
    'Healthcare': {
      kpis: {
        minAcceptableRating: 4.0,
        targetRating: 4.5,
        excellentRating: 4.8,
        minResponseRate: 0.4,
        targetResponseTime: 24,
        minMonthlyReviews: 15,
      },
      criticalAspects: ['care quality', 'wait time', 'staff', 'communication', 'cleanliness'],
      commonComplaints: ['wait time', 'billing', 'communication', 'appointment availability'],
      emergingTrends: ['telemedicine', 'online scheduling', 'price transparency'],
    },
    'SaaS': {
      kpis: {
        minAcceptableRating: 4.0,
        targetRating: 4.5,
        excellentRating: 4.8,
        minResponseRate: 0.8,
        targetResponseTime: 8,
        minMonthlyReviews: 10,
      },
      criticalAspects: ['features', 'ease of use', 'support', 'value', 'reliability'],
      commonComplaints: ['bugs', 'missing features', 'pricing', 'support response'],
      emergingTrends: ['AI integration', 'no-code features', 'integrations'],
    },
  };

  async generateBenchmark(
    businessId: string,
    industry: string,
    region?: string
  ): Promise<IndustryBenchmark> {
    try {
      // Get business metrics
      const businessMetrics = await this.calculateBusinessMetrics(businessId);

      // Get industry benchmarks
      const industryMetrics = await this.getIndustryMetrics(industry, region);

      // Calculate percentile rankings
      const percentileRanking = await this.calculatePercentileRanking(
        businessMetrics,
        industryMetrics,
        industry
      );

      // Get competitor comparisons
      const competitors = await this.getCompetitorComparisons(
        businessId,
        businessMetrics,
        industry,
        region
      );

      // Generate insights
      const insights = this.generateInsights(
        businessMetrics,
        industryMetrics,
        percentileRanking,
        industry
      );

      return {
        industry,
        region,
        metrics: industryMetrics,
        percentileRanking,
        competitorComparison: competitors,
        insights,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Failed to generate industry benchmark', { error, businessId });
      throw error;
    }
  }

  private async calculateBusinessMetrics(businessId: string): Promise<BenchmarkMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const reviews = await prisma.review.findMany({
      where: {
        collection: { userId: businessId },
        date: { gte: thirtyDaysAgo },
      },
    });

    const allReviews = await prisma.review.findMany({
      where: {
        collection: { userId: businessId },
      },
    });

    // Calculate metrics
    const totalReviews = allReviews.length;
    const recentReviews = reviews.length;
    
    const averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews || 0;
    
    const sentimentScores = allReviews
      .map(r => r.sentimentScore || 0)
      .filter(s => s !== 0);
    
    const averageSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length || 0;

    // Sentiment distribution
    const sentimentDistribution = {
      positive: sentimentScores.filter(s => s > 0.3).length / sentimentScores.length,
      neutral: sentimentScores.filter(s => s >= -0.3 && s <= 0.3).length / sentimentScores.length,
      negative: sentimentScores.filter(s => s < -0.3).length / sentimentScores.length,
    };

    // Response metrics (simulated for demo)
    const responseRate = 0.45; // 45% response rate
    const responseTime = { average: 18, median: 12 }; // hours

    // Aspect scores (simulated)
    const aspectScores = {
      service: 4.2,
      quality: 4.5,
      value: 4.0,
      experience: 4.3,
    };

    // Complaints and feature requests (simulated)
    const complaintsRate = 0.15; // 15% of reviews contain complaints
    const featureRequestsRate = 0.08; // 8% contain feature requests

    return {
      averageRating,
      reviewVolume: {
        monthly: recentReviews,
        growth: this.calculateGrowthRate(allReviews),
      },
      responseRate,
      responseTime,
      sentimentScore: {
        average: averageSentiment,
        distribution: sentimentDistribution,
      },
      aspectScores,
      complaintsRate,
      featureRequestsRate,
    };
  }

  private async getIndustryMetrics(
    industry: string,
    region?: string
  ): Promise<BenchmarkMetrics> {
    // In production, this would aggregate data from all businesses in the industry
    // For demo, return realistic industry averages

    const baseMetrics: Record<string, BenchmarkMetrics> = {
      'Restaurant': {
        averageRating: 4.1,
        reviewVolume: { monthly: 45, growth: 0.15 },
        responseRate: 0.35,
        responseTime: { average: 20, median: 16 },
        sentimentScore: {
          average: 0.42,
          distribution: { positive: 0.65, neutral: 0.20, negative: 0.15 },
        },
        aspectScores: {
          'food quality': 4.2,
          'service': 4.0,
          'cleanliness': 4.3,
          'value': 3.9,
          'atmosphere': 4.1,
        },
        complaintsRate: 0.20,
        featureRequestsRate: 0.05,
      },
      'Hotel': {
        averageRating: 4.2,
        reviewVolume: { monthly: 60, growth: 0.12 },
        responseRate: 0.65,
        responseTime: { average: 14, median: 10 },
        sentimentScore: {
          average: 0.48,
          distribution: { positive: 0.70, neutral: 0.18, negative: 0.12 },
        },
        aspectScores: {
          'cleanliness': 4.3,
          'comfort': 4.2,
          'location': 4.4,
          'service': 4.1,
          'value': 4.0,
        },
        complaintsRate: 0.18,
        featureRequestsRate: 0.06,
      },
      'E-commerce': {
        averageRating: 4.3,
        reviewVolume: { monthly: 120, growth: 0.25 },
        responseRate: 0.25,
        responseTime: { average: 36, median: 24 },
        sentimentScore: {
          average: 0.51,
          distribution: { positive: 0.72, neutral: 0.17, negative: 0.11 },
        },
        aspectScores: {
          'product quality': 4.3,
          'shipping': 4.1,
          'customer service': 4.2,
          'value': 4.4,
          'returns': 4.0,
        },
        complaintsRate: 0.15,
        featureRequestsRate: 0.10,
      },
    };

    // Apply regional adjustments if needed
    let metrics = baseMetrics[industry] || baseMetrics['Restaurant'];
    
    if (region) {
      metrics = this.applyRegionalAdjustments(metrics, region);
    }

    return metrics;
  }

  private async calculatePercentileRanking(
    businessMetrics: BenchmarkMetrics,
    industryMetrics: BenchmarkMetrics,
    industry: string
  ): Promise<PercentileRanking> {
    // Calculate percentiles based on normal distribution assumption
    const calculatePercentile = (value: number, mean: number, stdDev: number): number => {
      const zScore = (value - mean) / stdDev;
      // Approximate percentile from z-score
      const percentile = 0.5 * (1 + this.erf(zScore / Math.sqrt(2)));
      return Math.round(percentile * 100);
    };

    // Assumed standard deviations for different metrics
    const stdDevs = {
      rating: 0.3,
      volume: industryMetrics.reviewVolume.monthly * 0.4,
      responseRate: 0.15,
      sentiment: 0.2,
    };

    const ratingPercentile = calculatePercentile(
      businessMetrics.averageRating,
      industryMetrics.averageRating,
      stdDevs.rating
    );

    const volumePercentile = calculatePercentile(
      businessMetrics.reviewVolume.monthly,
      industryMetrics.reviewVolume.monthly,
      stdDevs.volume
    );

    const responsePercentile = calculatePercentile(
      businessMetrics.responseRate,
      industryMetrics.responseRate,
      stdDevs.responseRate
    );

    const sentimentPercentile = calculatePercentile(
      businessMetrics.sentimentScore.average,
      industryMetrics.sentimentScore.average,
      stdDevs.sentiment
    );

    // Calculate aspect percentiles
    const aspectRankings: Record<string, number> = {};
    for (const [aspect, score] of Object.entries(businessMetrics.aspectScores)) {
      const industryScore = industryMetrics.aspectScores[aspect] || 4.0;
      aspectRankings[aspect] = calculatePercentile(score, industryScore, 0.25);
    }

    // Overall percentile is weighted average
    const overall = Math.round(
      (ratingPercentile * 0.35 +
        volumePercentile * 0.15 +
        responsePercentile * 0.20 +
        sentimentPercentile * 0.30) 
    );

    return {
      overall,
      rating: ratingPercentile,
      volume: volumePercentile,
      responseRate: responsePercentile,
      sentiment: sentimentPercentile,
      aspectRankings,
    };
  }

  private async getCompetitorComparisons(
    businessId: string,
    businessMetrics: BenchmarkMetrics,
    industry: string,
    region?: string
  ): Promise<CompetitorComparison[]> {
    // In production, would fetch actual competitor data
    // For demo, generate realistic competitor profiles

    const competitors = [
      {
        competitorId: 'comp_1',
        name: 'Market Leader',
        metrics: {
          rating: 4.6,
          reviewCount: 1500,
          responseRate: 0.8,
          sentimentScore: 0.65,
        },
      },
      {
        competitorId: 'comp_2',
        name: 'Direct Competitor',
        metrics: {
          rating: 4.2,
          reviewCount: 800,
          responseRate: 0.5,
          sentimentScore: 0.48,
        },
      },
      {
        competitorId: 'comp_3',
        name: 'Emerging Player',
        metrics: {
          rating: 4.4,
          reviewCount: 300,
          responseRate: 0.9,
          sentimentScore: 0.55,
        },
      },
    ];

    return competitors.map(competitor => {
      const relativePerformance = {
        rating: ((businessMetrics.averageRating - competitor.metrics.rating) / competitor.metrics.rating) * 100,
        volume: ((businessMetrics.reviewVolume.monthly * 12 - competitor.metrics.reviewCount) / competitor.metrics.reviewCount) * 100,
        sentiment: ((businessMetrics.sentimentScore.average - competitor.metrics.sentimentScore) / competitor.metrics.sentimentScore) * 100,
      };

      const strengths: string[] = [];
      const weaknesses: string[] = [];

      // Identify strengths and weaknesses
      if (relativePerformance.rating > 5) strengths.push('Higher customer satisfaction');
      if (relativePerformance.rating < -5) weaknesses.push('Lower ratings than competitor');
      
      if (relativePerformance.volume > 20) strengths.push('More review volume');
      if (relativePerformance.volume < -20) weaknesses.push('Less social proof');
      
      if (businessMetrics.responseRate > competitor.metrics.responseRate) {
        strengths.push('Better review engagement');
      } else {
        weaknesses.push('Lower response rate');
      }

      return {
        ...competitor,
        relativePerformance,
        strengths,
        weaknesses,
      };
    });
  }

  private generateInsights(
    businessMetrics: BenchmarkMetrics,
    industryMetrics: BenchmarkMetrics,
    percentileRanking: PercentileRanking,
    industry: string
  ): BenchmarkInsight[] {
    const insights: BenchmarkInsight[] = [];
    const standards = this.industryStandards[industry];

    // Rating insights
    if (businessMetrics.averageRating >= standards.kpis.excellentRating) {
      insights.push({
        type: 'strength',
        title: 'Exceptional Customer Satisfaction',
        description: `Your rating of ${businessMetrics.averageRating.toFixed(1)} places you in the top ${100 - percentileRanking.rating}% of ${industry} businesses.`,
        impact: 'high',
        recommendation: 'Leverage this strength in marketing materials and case studies.',
      });
    } else if (businessMetrics.averageRating < standards.kpis.minAcceptableRating) {
      insights.push({
        type: 'weakness',
        title: 'Below Industry Standard Rating',
        description: `Your rating is ${((standards.kpis.targetRating - businessMetrics.averageRating) / standards.kpis.targetRating * 100).toFixed(1)}% below the industry target.`,
        impact: 'high',
        recommendation: 'Implement immediate service improvements and response strategies.',
        potentialImprovement: 15,
      });
    }

    // Response rate insights
    if (businessMetrics.responseRate < standards.kpis.minResponseRate) {
      insights.push({
        type: 'weakness',
        title: 'Low Review Response Rate',
        description: `You're responding to only ${(businessMetrics.responseRate * 100).toFixed(1)}% of reviews, below the industry minimum of ${(standards.kpis.minResponseRate * 100).toFixed(1)}%.`,
        impact: 'medium',
        recommendation: 'Implement automated response suggestions to increase engagement.',
        potentialImprovement: 20,
      });
    }

    // Volume insights
    if (businessMetrics.reviewVolume.monthly < standards.kpis.minMonthlyReviews) {
      insights.push({
        type: 'opportunity',
        title: 'Increase Review Collection',
        description: `Your monthly review volume is ${Math.round((standards.kpis.minMonthlyReviews - businessMetrics.reviewVolume.monthly) / standards.kpis.minMonthlyReviews * 100)}% below industry standard.`,
        impact: 'medium',
        recommendation: 'Implement automated review request campaigns.',
        potentialImprovement: 30,
      });
    }

    // Sentiment insights
    if (businessMetrics.sentimentScore.distribution.negative > industryMetrics.sentimentScore.distribution.negative * 1.5) {
      insights.push({
        type: 'threat',
        title: 'High Negative Sentiment',
        description: `Your negative sentiment rate is ${((businessMetrics.sentimentScore.distribution.negative - industryMetrics.sentimentScore.distribution.negative) / industryMetrics.sentimentScore.distribution.negative * 100).toFixed(1)}% higher than industry average.`,
        impact: 'high',
        recommendation: 'Analyze negative reviews to identify and address root causes.',
      });
    }

    // Aspect-specific insights
    for (const [aspect, score] of Object.entries(businessMetrics.aspectScores)) {
      const industryScore = industryMetrics.aspectScores[aspect];
      if (industryScore && score < industryScore * 0.9) {
        insights.push({
          type: 'weakness',
          title: `Below Average ${this.capitalize(aspect)}`,
          description: `Your ${aspect} score is ${((industryScore - score) / industryScore * 100).toFixed(1)}% below industry average.`,
          impact: 'medium',
          recommendation: `Focus improvement efforts on ${aspect} to match industry standards.`,
          potentialImprovement: 10,
        });
      }
    }

    // Growth insights
    if (businessMetrics.reviewVolume.growth > industryMetrics.reviewVolume.growth * 1.5) {
      insights.push({
        type: 'strength',
        title: 'Rapid Growth Trajectory',
        description: `Your review volume is growing ${(businessMetrics.reviewVolume.growth * 100).toFixed(1)}% YoY, significantly above industry average.`,
        impact: 'high',
        recommendation: 'Maintain momentum while ensuring quality doesn't suffer.',
      });
    }

    // Sort by impact
    return insights.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }

  private calculateGrowthRate(reviews: any[]): number {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const recentReviews = reviews.filter(r => r.date > oneYearAgo).length;
    const olderReviews = reviews.filter(r => r.date <= oneYearAgo).length;

    if (olderReviews === 0) return 1; // 100% growth if no older reviews

    return (recentReviews - olderReviews) / olderReviews;
  }

  private applyRegionalAdjustments(
    metrics: BenchmarkMetrics,
    region: string
  ): BenchmarkMetrics {
    // Regional adjustments based on market maturity
    const adjustments: Record<string, number> = {
      'North America': 1.0,
      'Europe': 0.95,
      'Asia': 1.05,
      'South America': 0.90,
      'Africa': 0.85,
      'Oceania': 0.98,
    };

    const factor = adjustments[region] || 1.0;

    return {
      ...metrics,
      reviewVolume: {
        monthly: Math.round(metrics.reviewVolume.monthly * factor),
        growth: metrics.reviewVolume.growth,
      },
      responseRate: metrics.responseRate * factor,
    };
  }

  // Error function approximation for normal distribution
  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Public methods for accessing industry data
  async getIndustryTrends(industry: string): Promise<string[]> {
    return this.industryStandards[industry]?.emergingTrends || [];
  }

  async getIndustryKPIs(industry: string): Promise<any> {
    return this.industryStandards[industry]?.kpis || null;
  }

  async getCriticalAspects(industry: string): Promise<string[]> {
    return this.industryStandards[industry]?.criticalAspects || [];
  }
}