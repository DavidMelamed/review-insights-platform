import { prisma } from '../database';
import { Review, User } from '@prisma/client';
import { logger } from '../utils/logger';

export interface ChurnPrediction {
  userId: string;
  probability: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  predictedChurnDate?: Date;
  recommendedActions: string[];
  confidence: number;
}

export interface ChurnFactor {
  name: string;
  impact: number; // -1 to 1 (negative reduces churn, positive increases)
  description: string;
}

export interface TrendForecast {
  metric: string;
  currentValue: number;
  predictions: TimePrediction[];
  confidence: number;
  seasonality?: SeasonalityPattern;
  anomalies: Anomaly[];
}

export interface TimePrediction {
  date: Date;
  value: number;
  upperBound: number;
  lowerBound: number;
}

export interface SeasonalityPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  strength: number; // 0-1
  peakPeriods: string[];
  troughPeriods: string[];
}

export interface Anomaly {
  date: Date;
  actual: number;
  expected: number;
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
}

export interface RevenueImpact {
  sentimentChange: number;
  estimatedRevenueChange: number;
  confidence: number;
  timeframe: string;
  breakdown: {
    retentionImpact: number;
    acquisitionImpact: number;
    upsellImpact: number;
  };
}

export class PredictiveAnalyticsService {
  async predictCustomerChurn(customerId: string): Promise<ChurnPrediction> {
    try {
      const customer = await prisma.user.findUnique({
        where: { id: customerId },
        include: {
          subscription: true,
          collections: {
            include: {
              reviews: true,
            },
          },
          usageRecords: {
            orderBy: { createdAt: 'desc' },
            take: 100,
          },
        },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Analyze churn factors
      const factors: ChurnFactor[] = [];
      let churnScore = 0;

      // 1. Sentiment trend
      const sentimentTrend = await this.analyzeSentimentTrend(customer.collections);
      if (sentimentTrend.isDecreasing) {
        factors.push({
          name: 'Declining Sentiment',
          impact: 0.3,
          description: `Sentiment decreased by ${Math.abs(sentimentTrend.change * 100).toFixed(1)}% over last 3 months`,
        });
        churnScore += 0.3;
      }

      // 2. Usage patterns
      const usagePattern = this.analyzeUsagePattern(customer.usageRecords);
      if (usagePattern.isDecreasing) {
        factors.push({
          name: 'Reduced Usage',
          impact: 0.4,
          description: `Platform usage down ${Math.abs(usagePattern.change * 100).toFixed(1)}% in last month`,
        });
        churnScore += 0.4;
      }

      // 3. Support interactions
      const supportScore = await this.analyzeSupportInteractions(customerId);
      if (supportScore > 0.5) {
        factors.push({
          name: 'High Support Volume',
          impact: 0.2,
          description: 'Above average support tickets indicating potential issues',
        });
        churnScore += 0.2;
      }

      // 4. Competitive mentions
      const competitiveMentions = await this.analyzeCompetitiveMentions(customer.collections);
      if (competitiveMentions > 0.2) {
        factors.push({
          name: 'Competitor Interest',
          impact: 0.3,
          description: `${(competitiveMentions * 100).toFixed(1)}% of reviews mention competitors`,
        });
        churnScore += 0.3;
      }

      // 5. Review response rate
      const responseRate = await this.analyzeResponseRate(customer.collections);
      if (responseRate < 0.3) {
        factors.push({
          name: 'Low Response Rate',
          impact: 0.2,
          description: `Only responding to ${(responseRate * 100).toFixed(1)}% of reviews`,
        });
        churnScore += 0.2;
      }

      // 6. Plan utilization
      const utilization = await this.analyzePlanUtilization(customer);
      if (utilization < 0.2) {
        factors.push({
          name: 'Low Plan Utilization',
          impact: 0.3,
          description: `Using only ${(utilization * 100).toFixed(1)}% of plan features`,
        });
        churnScore += 0.3;
      }

      // Normalize churn score
      const probability = Math.min(churnScore / 2, 0.95); // Max 95% probability

      // Determine risk level
      let riskLevel: ChurnPrediction['riskLevel'];
      if (probability >= 0.7) riskLevel = 'critical';
      else if (probability >= 0.5) riskLevel = 'high';
      else if (probability >= 0.3) riskLevel = 'medium';
      else riskLevel = 'low';

      // Predict churn date
      const predictedChurnDate = this.predictChurnDate(probability, customer.subscription);

      // Generate recommendations
      const recommendedActions = this.generateChurnPreventionActions(factors, customer);

      return {
        userId: customerId,
        probability,
        riskLevel,
        factors,
        predictedChurnDate,
        recommendedActions,
        confidence: this.calculateConfidence(factors.length, customer.createdAt),
      };
    } catch (error) {
      logger.error('Failed to predict churn', { error, customerId });
      throw error;
    }
  }

  async forecastSentimentTrend(
    businessId: string,
    daysAhead: number = 30
  ): Promise<TrendForecast> {
    try {
      // Get historical sentiment data
      const historicalData = await this.getHistoricalSentiment(businessId);
      
      if (historicalData.length < 30) {
        throw new Error('Insufficient data for forecasting');
      }

      // Detect seasonality
      const seasonality = this.detectSeasonality(historicalData);

      // Apply time series forecasting
      const predictions = this.applyARIMA(historicalData, daysAhead, seasonality);

      // Detect anomalies in historical data
      const anomalies = this.detectAnomalies(historicalData);

      return {
        metric: 'sentiment_score',
        currentValue: historicalData[historicalData.length - 1].value,
        predictions,
        confidence: this.calculateForecastConfidence(historicalData),
        seasonality,
        anomalies,
      };
    } catch (error) {
      logger.error('Failed to forecast sentiment', { error, businessId });
      throw error;
    }
  }

  async calculateRevenueImpact(
    businessId: string,
    sentimentChange: number
  ): Promise<RevenueImpact> {
    try {
      // Historical correlation between sentiment and revenue
      const correlation = await this.getSentimentRevenueCorrelation(businessId);
      
      // Base impact calculation
      const baseImpact = sentimentChange * correlation * 0.15; // 15% max impact
      
      // Break down impact
      const retentionImpact = baseImpact * 0.6; // 60% from retention
      const acquisitionImpact = baseImpact * 0.3; // 30% from new customers
      const upsellImpact = baseImpact * 0.1; // 10% from upsells

      return {
        sentimentChange,
        estimatedRevenueChange: baseImpact,
        confidence: Math.min(correlation * 1.2, 0.9),
        timeframe: '3-6 months',
        breakdown: {
          retentionImpact,
          acquisitionImpact,
          upsellImpact,
        },
      };
    } catch (error) {
      logger.error('Failed to calculate revenue impact', { error });
      throw error;
    }
  }

  private async analyzeSentimentTrend(collections: any[]): Promise<any> {
    if (collections.length === 0) return { isDecreasing: false, change: 0 };

    const monthlyAverages = new Map<string, number[]>();

    collections.forEach(collection => {
      collection.reviews.forEach((review: any) => {
        const monthKey = `${review.date.getFullYear()}-${review.date.getMonth()}`;
        if (!monthlyAverages.has(monthKey)) {
          monthlyAverages.set(monthKey, []);
        }
        monthlyAverages.get(monthKey)!.push(review.sentimentScore || 0);
      });
    });

    const sortedMonths = Array.from(monthlyAverages.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3); // Last 3 months

    if (sortedMonths.length < 2) return { isDecreasing: false, change: 0 };

    const averages = sortedMonths.map(([_, scores]) => 
      scores.reduce((a, b) => a + b, 0) / scores.length
    );

    const change = (averages[averages.length - 1] - averages[0]) / Math.abs(averages[0]);
    
    return {
      isDecreasing: change < -0.1,
      change,
    };
  }

  private analyzeUsagePattern(usageRecords: any[]): any {
    if (usageRecords.length < 10) return { isDecreasing: false, change: 0 };

    // Group by week
    const weeklyUsage = new Map<string, number>();
    const now = new Date();

    usageRecords.forEach(record => {
      const weeksDiff = Math.floor((now.getTime() - record.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const weekKey = `week_${weeksDiff}`;
      weeklyUsage.set(weekKey, (weeklyUsage.get(weekKey) || 0) + 1);
    });

    // Compare last week to average of previous 3 weeks
    const lastWeek = weeklyUsage.get('week_0') || 0;
    const previousAvg = (
      (weeklyUsage.get('week_1') || 0) +
      (weeklyUsage.get('week_2') || 0) +
      (weeklyUsage.get('week_3') || 0)
    ) / 3;

    const change = previousAvg > 0 ? (lastWeek - previousAvg) / previousAvg : 0;

    return {
      isDecreasing: change < -0.3,
      change,
    };
  }

  private async analyzeSupportInteractions(userId: string): Promise<number> {
    // In production, would query support ticket system
    // For now, return simulated score
    return Math.random() * 0.8;
  }

  private async analyzeCompetitiveMentions(collections: any[]): Promise<number> {
    let totalReviews = 0;
    let competitorMentions = 0;

    const competitorKeywords = [
      'competitor', 'alternative', 'switched from', 'better than',
      'compared to', 'versus', 'vs', 'instead of'
    ];

    collections.forEach(collection => {
      collection.reviews.forEach((review: any) => {
        totalReviews++;
        const content = review.content.toLowerCase();
        if (competitorKeywords.some(keyword => content.includes(keyword))) {
          competitorMentions++;
        }
      });
    });

    return totalReviews > 0 ? competitorMentions / totalReviews : 0;
  }

  private async analyzeResponseRate(collections: any[]): Promise<number> {
    let totalReviews = 0;
    let respondedReviews = 0;

    collections.forEach(collection => {
      collection.reviews.forEach((review: any) => {
        totalReviews++;
        // In production, would check if review has response
        if (Math.random() > 0.7) respondedReviews++;
      });
    });

    return totalReviews > 0 ? respondedReviews / totalReviews : 0;
  }

  private async analyzePlanUtilization(customer: any): Promise<number> {
    // Analyze feature usage vs plan capabilities
    const planFeatures = {
      FREE: 3,
      STARTER: 6,
      PROFESSIONAL: 10,
      ENTERPRISE: 15,
    };

    const totalFeatures = planFeatures[customer.subscription?.plan || 'FREE'];
    const usedFeatures = Math.min(customer.usageRecords.length / 10, totalFeatures);

    return usedFeatures / totalFeatures;
  }

  private predictChurnDate(probability: number, subscription: any): Date | undefined {
    if (!subscription || probability < 0.5) return undefined;

    const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
    const daysUntilRenewal = Math.ceil((currentPeriodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

    // High probability churners likely to cancel before next renewal
    if (probability > 0.8) {
      return new Date(Date.now() + Math.min(daysUntilRenewal, 30) * 24 * 60 * 60 * 1000);
    }

    // Medium probability might wait until renewal
    return currentPeriodEnd;
  }

  private generateChurnPreventionActions(factors: ChurnFactor[], customer: any): string[] {
    const actions: string[] = [];

    factors.forEach(factor => {
      switch (factor.name) {
        case 'Declining Sentiment':
          actions.push('Schedule customer success call to address concerns');
          actions.push('Offer complimentary training session');
          break;
        case 'Reduced Usage':
          actions.push('Send personalized tips to increase engagement');
          actions.push('Offer feature walkthrough');
          break;
        case 'High Support Volume':
          actions.push('Assign dedicated support representative');
          actions.push('Proactively address common issues');
          break;
        case 'Competitor Interest':
          actions.push('Highlight unique value propositions');
          actions.push('Offer loyalty discount');
          break;
        case 'Low Response Rate':
          actions.push('Provide response templates and automation');
          actions.push('Offer managed response service trial');
          break;
        case 'Low Plan Utilization':
          actions.push('Provide personalized onboarding');
          actions.push('Suggest plan optimization');
          break;
      }
    });

    return [...new Set(actions)]; // Remove duplicates
  }

  private calculateConfidence(factorCount: number, accountAge: Date): number {
    const ageInDays = (Date.now() - accountAge.getTime()) / (24 * 60 * 60 * 1000);
    const ageScore = Math.min(ageInDays / 180, 1); // Max confidence at 6 months
    const factorScore = Math.min(factorCount / 5, 1); // Max confidence with 5+ factors
    
    return (ageScore + factorScore) / 2;
  }

  private async getHistoricalSentiment(businessId: string): Promise<any[]> {
    const reviews = await prisma.review.findMany({
      where: {
        collection: { userId: businessId },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        sentimentScore: true,
      },
    });

    // Aggregate by day
    const dailyData = new Map<string, number[]>();
    
    reviews.forEach(review => {
      const dateKey = review.date.toISOString().split('T')[0];
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, []);
      }
      dailyData.get(dateKey)!.push(review.sentimentScore || 0);
    });

    return Array.from(dailyData.entries()).map(([date, scores]) => ({
      date: new Date(date),
      value: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));
  }

  private detectSeasonality(data: any[]): SeasonalityPattern | undefined {
    // Simplified seasonality detection
    // In production, would use more sophisticated methods like FFT

    const weeklyPattern = this.checkWeeklyPattern(data);
    const monthlyPattern = this.checkMonthlyPattern(data);

    if (weeklyPattern.strength > monthlyPattern.strength && weeklyPattern.strength > 0.3) {
      return weeklyPattern;
    }

    if (monthlyPattern.strength > 0.3) {
      return monthlyPattern;
    }

    return undefined;
  }

  private checkWeeklyPattern(data: any[]): SeasonalityPattern {
    // Group by day of week
    const dayGroups = new Map<number, number[]>();
    
    data.forEach(point => {
      const dayOfWeek = point.date.getDay();
      if (!dayGroups.has(dayOfWeek)) {
        dayGroups.set(dayOfWeek, []);
      }
      dayGroups.get(dayOfWeek)!.push(point.value);
    });

    // Calculate variance
    const averages = Array.from(dayGroups.entries()).map(([day, values]) => ({
      day,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    }));

    const overallAvg = data.reduce((a, b) => a + b.value, 0) / data.length;
    const variance = averages.reduce((sum, { avg }) => sum + Math.pow(avg - overallAvg, 2), 0) / 7;
    const strength = Math.min(Math.sqrt(variance) / overallAvg, 1);

    const sorted = averages.sort((a, b) => b.avg - a.avg);

    return {
      type: 'weekly',
      strength,
      peakPeriods: sorted.slice(0, 2).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day]),
      troughPeriods: sorted.slice(-2).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day]),
    };
  }

  private checkMonthlyPattern(data: any[]): SeasonalityPattern {
    // Similar to weekly but for days of month
    return {
      type: 'monthly',
      strength: 0.2, // Simplified
      peakPeriods: ['1st week', 'Last week'],
      troughPeriods: ['3rd week'],
    };
  }

  private applyARIMA(
    data: any[],
    steps: number,
    seasonality?: SeasonalityPattern
  ): TimePrediction[] {
    // Simplified ARIMA implementation
    // In production, would use proper statistical libraries

    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = this.calculateTrend(values);
    
    const predictions: TimePrediction[] = [];
    const lastDate = data[data.length - 1].date;
    
    for (let i = 1; i <= steps; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);
      
      let value = mean + (trend * i);
      
      // Apply seasonality
      if (seasonality) {
        const seasonalAdjustment = this.getSeasonalAdjustment(date, seasonality);
        value *= (1 + seasonalAdjustment);
      }
      
      // Add confidence bounds
      const uncertainty = 0.1 * Math.sqrt(i); // Uncertainty grows with time
      
      predictions.push({
        date,
        value,
        upperBound: value * (1 + uncertainty),
        lowerBound: value * (1 - uncertainty),
      });
    }
    
    return predictions;
  }

  private calculateTrend(values: number[]): number {
    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + (x + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private getSeasonalAdjustment(date: Date, seasonality: SeasonalityPattern): number {
    switch (seasonality.type) {
      case 'weekly':
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        if (seasonality.peakPeriods.includes(dayName)) return 0.1;
        if (seasonality.troughPeriods.includes(dayName)) return -0.1;
        return 0;
      
      case 'monthly':
        const dayOfMonth = date.getDate();
        if (dayOfMonth <= 7 && seasonality.peakPeriods.includes('1st week')) return 0.1;
        if (dayOfMonth >= 24 && seasonality.peakPeriods.includes('Last week')) return 0.1;
        return 0;
      
      default:
        return 0;
    }
  }

  private detectAnomalies(data: any[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    
    data.forEach((point, index) => {
      const zScore = Math.abs((point.value - mean) / stdDev);
      
      if (zScore > 3) {
        anomalies.push({
          date: point.date,
          actual: point.value,
          expected: mean,
          severity: 'high',
          possibleCauses: this.identifyAnomalyCauses(point, data, index),
        });
      } else if (zScore > 2) {
        anomalies.push({
          date: point.date,
          actual: point.value,
          expected: mean,
          severity: 'medium',
          possibleCauses: this.identifyAnomalyCauses(point, data, index),
        });
      }
    });
    
    return anomalies;
  }

  private identifyAnomalyCauses(point: any, data: any[], index: number): string[] {
    const causes: string[] = [];
    
    // Check for sudden changes
    if (index > 0) {
      const change = Math.abs(point.value - data[index - 1].value);
      if (change > 0.5) {
        causes.push('Sudden change in sentiment');
      }
    }
    
    // Check day of week
    const dayOfWeek = point.date.getDay();
    if (dayOfWeek === 1) causes.push('Monday effect');
    if (dayOfWeek === 5) causes.push('Friday effect');
    
    // Check for holidays (simplified)
    const month = point.date.getMonth();
    const day = point.date.getDate();
    if (month === 11 && day >= 20) causes.push('Holiday season');
    if (month === 0 && day <= 7) causes.push('New Year period');
    
    if (causes.length === 0) {
      causes.push('Unknown external factor');
    }
    
    return causes;
  }

  private calculateForecastConfidence(data: any[]): number {
    // Based on data quantity and consistency
    const dataPoints = data.length;
    const dataScore = Math.min(dataPoints / 100, 1);
    
    // Calculate variance
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const consistencyScore = 1 - Math.min(variance, 1);
    
    return (dataScore + consistencyScore) / 2;
  }

  private async getSentimentRevenueCorrelation(businessId: string): Promise<number> {
    // In production, would calculate actual correlation with revenue data
    // For demo, return reasonable correlation
    return 0.65; // 65% correlation between sentiment and revenue
  }
}