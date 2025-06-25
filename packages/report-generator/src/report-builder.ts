import { ReviewData } from '../../scraper/src/dataforseo-client';
import { SentimentResult, AspectSentiment, ComplaintDetection, FeatureRequest } from '../../nlp-engine/src/sentiment-analyzer';

export interface BrandConfig {
  name: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  font?: string;
}

export interface ReportSection {
  title: string;
  content: any;
  type: 'text' | 'chart' | 'table' | 'list' | 'quote';
  priority: number;
}

export interface ReportData {
  brand: BrandConfig;
  executiveSummary: string;
  sections: ReportSection[];
  insights: Insight[];
  recommendations: Recommendation[];
  citations: Citation[];
  metadata: ReportMetadata;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  category: string;
  evidence: string[];
  citations: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short-term' | 'long-term';
  expectedImpact: string;
}

export interface Citation {
  id: string;
  source: string;
  author: string;
  date: Date;
  content: string;
  url?: string;
  pageNumber?: number;
}

export interface ReportMetadata {
  generatedAt: Date;
  dataCollectionPeriod: { start: Date; end: Date };
  totalReviews: number;
  sources: string[];
  version: string;
}

export class ReportBuilder {
  private citationCounter = 0;
  private citations: Map<string, Citation> = new Map();

  buildReport(
    reviews: ReviewData[],
    sentiment: {
      overallSentiment: SentimentResult;
      aspectSentiments: AspectSentiment[];
      complaints: ComplaintDetection[];
      featureRequests: FeatureRequest[];
    },
    brand: BrandConfig
  ): ReportData {
    const insights = this.generateInsights(reviews, sentiment);
    const recommendations = this.generateRecommendations(insights, sentiment);
    const sections = this.buildSections(reviews, sentiment, insights);
    const executiveSummary = this.generateExecutiveSummary(reviews, sentiment, insights);

    const metadata: ReportMetadata = {
      generatedAt: new Date(),
      dataCollectionPeriod: this.getDateRange(reviews),
      totalReviews: reviews.length,
      sources: [...new Set(reviews.map(r => r.source))],
      version: '1.0.0',
    };

    return {
      brand,
      executiveSummary,
      sections,
      insights,
      recommendations,
      citations: Array.from(this.citations.values()),
      metadata,
    };
  }

  private generateInsights(
    reviews: ReviewData[],
    sentiment: any
  ): Insight[] {
    const insights: Insight[] = [];

    // Sentiment-based insights
    if (sentiment.overallSentiment.score > 0.5) {
      insights.push({
        id: 'insight_1',
        title: 'Strong Positive Brand Perception',
        description: `Customers demonstrate overwhelmingly positive sentiment (${(sentiment.overallSentiment.score * 100).toFixed(1)}% positive) across ${reviews.length} reviews.`,
        impact: 'high',
        category: 'brand-perception',
        evidence: this.findEvidenceForSentiment(reviews, 'positive'),
        citations: this.createCitationsForReviews(reviews.slice(0, 3)),
      });
    }

    // Complaint patterns
    if (sentiment.complaints.length > 5) {
      const complaintsByCategory = this.groupBy(sentiment.complaints, 'category');
      const topCategory = Object.entries(complaintsByCategory)
        .sort(([, a], [, b]) => b.length - a.length)[0];

      insights.push({
        id: 'insight_2',
        title: `Critical Issue: ${this.capitalize(topCategory[0])} Complaints`,
        description: `${topCategory[1].length} complaints identified related to ${topCategory[0]}, requiring immediate attention.`,
        impact: 'high',
        category: 'complaints',
        evidence: topCategory[1].slice(0, 3).map(c => c.keywords.join(', ')),
        citations: this.createCitationsForComplaints(topCategory[1].slice(0, 3)),
      });
    }

    // Feature request insights
    if (sentiment.featureRequests.length > 0) {
      const topRequest = sentiment.featureRequests[0];
      insights.push({
        id: 'insight_3',
        title: 'Top Customer Feature Request',
        description: `Multiple customers (${topRequest.frequency}) have requested: "${topRequest.feature}"`,
        impact: 'medium',
        category: 'product-development',
        evidence: [topRequest.feature],
        citations: this.createCitationsForFeatureRequest(topRequest),
      });
    }

    // Aspect-based insights
    const topAspects = sentiment.aspectSentiments.slice(0, 3);
    topAspects.forEach((aspect, index) => {
      if (aspect.mentions > 5) {
        insights.push({
          id: `insight_aspect_${index}`,
          title: `${this.capitalize(aspect.aspect)} Performance`,
          description: `${aspect.aspect} mentioned in ${aspect.mentions} reviews with ${aspect.sentiment.label} sentiment (${(aspect.sentiment.score * 100).toFixed(1)}% score).`,
          impact: aspect.sentiment.label === 'negative' ? 'high' : 'medium',
          category: 'aspect-analysis',
          evidence: aspect.examples,
          citations: this.createCitationsForAspect(aspect),
        });
      }
    });

    return insights;
  }

  private generateRecommendations(
    insights: Insight[],
    sentiment: any
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Based on complaints
    if (sentiment.complaints.length > 0) {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const priorityComplaints = sentiment.complaints
        .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
        .slice(0, 3);

      priorityComplaints.forEach((complaint, index) => {
        recommendations.push({
          id: `rec_complaint_${index}`,
          title: `Address ${this.capitalize(complaint.category)} Issues`,
          description: complaint.suggestedAction || 'Implement systematic improvements',
          priority: complaint.severity as any,
          timeframe: complaint.severity === 'high' ? 'immediate' : 'short-term',
          expectedImpact: `Reduce ${complaint.category}-related complaints by 50%`,
        });
      });
    }

    // Based on feature requests
    sentiment.featureRequests.slice(0, 2).forEach((request, index) => {
      recommendations.push({
        id: `rec_feature_${index}`,
        title: 'Implement Requested Feature',
        description: `Develop and launch: ${request.feature}`,
        priority: request.priority,
        timeframe: 'short-term',
        expectedImpact: `Increase customer satisfaction and reduce feature-related complaints`,
      });
    });

    // Based on aspect sentiments
    const negativeAspects = sentiment.aspectSentiments
      .filter(a => a.sentiment.label === 'negative' && a.mentions > 3);

    negativeAspects.forEach((aspect, index) => {
      recommendations.push({
        id: `rec_aspect_${index}`,
        title: `Improve ${this.capitalize(aspect.aspect)}`,
        description: `Focus on enhancing ${aspect.aspect} based on customer feedback`,
        priority: 'medium',
        timeframe: 'short-term',
        expectedImpact: `Convert negative ${aspect.aspect} perception to positive`,
      });
    });

    return recommendations;
  }

  private buildSections(
    reviews: ReviewData[],
    sentiment: any,
    insights: Insight[]
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    // Overview section
    sections.push({
      title: 'Sentiment Overview',
      content: {
        overall: sentiment.overallSentiment,
        distribution: this.calculateSentimentDistribution(reviews),
        trend: this.calculateSentimentTrend(reviews),
      },
      type: 'chart',
      priority: 1,
    });

    // Top insights section
    sections.push({
      title: 'Key Insights',
      content: insights.slice(0, 5).map(i => ({
        title: i.title,
        description: i.description,
        impact: i.impact,
      })),
      type: 'list',
      priority: 2,
    });

    // Complaints analysis
    if (sentiment.complaints.length > 0) {
      sections.push({
        title: 'Complaint Analysis',
        content: {
          total: sentiment.complaints.length,
          byCategory: this.groupBy(sentiment.complaints, 'category'),
          bySeverity: this.groupBy(sentiment.complaints, 'severity'),
        },
        type: 'chart',
        priority: 3,
      });
    }

    // Voice of customer
    const topQuotes = this.selectTopQuotes(reviews, sentiment);
    sections.push({
      title: 'Voice of Customer',
      content: topQuotes,
      type: 'quote',
      priority: 4,
    });

    // Competitive insights
    const competitorMentions = this.findCompetitorMentions(reviews);
    if (competitorMentions.length > 0) {
      sections.push({
        title: 'Competitive Analysis',
        content: competitorMentions,
        type: 'table',
        priority: 5,
      });
    }

    return sections.sort((a, b) => a.priority - b.priority);
  }

  private generateExecutiveSummary(
    reviews: ReviewData[],
    sentiment: any,
    insights: Insight[]
  ): string {
    const sentimentScore = (sentiment.overallSentiment.score * 100).toFixed(1);
    const topInsight = insights[0];
    const mainComplaint = sentiment.complaints.length > 0 
      ? sentiment.complaints[0].category 
      : null;

    let summary = `Based on analysis of ${reviews.length} customer reviews collected from ${
      [...new Set(reviews.map(r => r.source))].join(', ')
    }, the overall customer sentiment is ${sentiment.overallSentiment.label} with a score of ${sentimentScore}%. `;

    if (topInsight) {
      summary += `The most significant finding is: ${topInsight.description} `;
    }

    if (mainComplaint) {
      summary += `Primary area of concern relates to ${mainComplaint} issues, which require immediate attention. `;
    }

    if (sentiment.featureRequests.length > 0) {
      summary += `Customers have expressed ${sentiment.featureRequests.length} feature requests, indicating opportunities for product enhancement. `;
    }

    summary += `This report provides detailed analysis, actionable insights, and strategic recommendations to improve customer satisfaction and drive business growth.`;

    return summary;
  }

  // Helper methods
  private createCitationsForReviews(reviews: ReviewData[]): string[] {
    return reviews.map(review => {
      const citationId = `cite_${++this.citationCounter}`;
      this.citations.set(citationId, {
        id: citationId,
        source: review.source,
        author: review.author,
        date: review.date,
        content: review.content,
        url: review.url,
      });
      return citationId;
    });
  }

  private createCitationsForComplaints(complaints: ComplaintDetection[]): string[] {
    // In real implementation, would map complaints back to original reviews
    return [`cite_complaint_${++this.citationCounter}`];
  }

  private createCitationsForFeatureRequest(request: FeatureRequest): string[] {
    return [`cite_feature_${++this.citationCounter}`];
  }

  private createCitationsForAspect(aspect: AspectSentiment): string[] {
    return aspect.examples.map((_, index) => `cite_aspect_${++this.citationCounter}`);
  }

  private findEvidenceForSentiment(reviews: ReviewData[], sentimentType: string): string[] {
    return reviews
      .filter(r => {
        // Simple sentiment detection for demo
        const positive = /excellent|amazing|great|love/i.test(r.content);
        const negative = /terrible|awful|bad|hate/i.test(r.content);
        return sentimentType === 'positive' ? positive : negative;
      })
      .slice(0, 3)
      .map(r => r.content.substring(0, 100) + '...');
  }

  private calculateSentimentDistribution(reviews: ReviewData[]): any {
    const distribution = { positive: 0, negative: 0, neutral: 0 };
    // Simplified calculation for demo
    reviews.forEach(r => {
      if (r.rating >= 4) distribution.positive++;
      else if (r.rating <= 2) distribution.negative++;
      else distribution.neutral++;
    });
    return distribution;
  }

  private calculateSentimentTrend(reviews: ReviewData[]): any {
    // Group reviews by month and calculate average sentiment
    const monthlyData = new Map<string, number[]>();
    
    reviews.forEach(r => {
      const monthKey = `${r.date.getFullYear()}-${r.date.getMonth() + 1}`;
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, []);
      }
      monthlyData.get(monthKey)!.push(r.rating);
    });

    return Array.from(monthlyData.entries()).map(([month, ratings]) => ({
      month,
      averageRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
    }));
  }

  private selectTopQuotes(reviews: ReviewData[], sentiment: any): any[] {
    // Select impactful quotes from different sentiment categories
    const quotes = [];
    
    // Positive quote
    const positiveReview = reviews.find(r => r.rating >= 4 && r.content.length > 50);
    if (positiveReview) {
      quotes.push({
        text: positiveReview.content,
        author: positiveReview.author,
        sentiment: 'positive',
        citation: this.createCitationsForReviews([positiveReview])[0],
      });
    }

    // Negative quote with constructive feedback
    const constructiveReview = reviews.find(r => 
      r.rating <= 3 && 
      r.content.length > 50 &&
      /suggest|recommend|should|could/i.test(r.content)
    );
    if (constructiveReview) {
      quotes.push({
        text: constructiveReview.content,
        author: constructiveReview.author,
        sentiment: 'constructive',
        citation: this.createCitationsForReviews([constructiveReview])[0],
      });
    }

    return quotes;
  }

  private findCompetitorMentions(reviews: ReviewData[]): any[] {
    const competitors = ['competitor1', 'competitor2']; // Would be dynamic
    const mentions = [];

    reviews.forEach(review => {
      competitors.forEach(competitor => {
        if (review.content.toLowerCase().includes(competitor)) {
          mentions.push({
            competitor,
            sentiment: review.rating >= 3 ? 'positive' : 'negative',
            context: review.content,
            citation: this.createCitationsForReviews([review])[0],
          });
        }
      });
    });

    return mentions;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
      const group = String(item[key]);
      if (!result[group]) result[group] = [];
      result[group].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getDateRange(reviews: ReviewData[]): { start: Date; end: Date } {
    const dates = reviews.map(r => r.date.getTime());
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    };
  }
}