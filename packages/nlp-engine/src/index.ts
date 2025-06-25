import Sentiment from 'sentiment';
import { z } from 'zod';

const sentiment = new Sentiment();

export const AnalysisResultSchema = z.object({
  sentiment: z.object({
    score: z.number(),
    comparative: z.number(),
    label: z.enum(['positive', 'negative', 'neutral']),
  }),
  keywords: z.array(z.string()),
  entities: z.array(z.object({
    text: z.string(),
    type: z.string(),
    sentiment: z.number().optional(),
  })),
  topics: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  summary: z.string(),
  insights: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export class NLPEngine {
  analyzeSentiment(text: string): { score: number; comparative: number; label: 'positive' | 'negative' | 'neutral' } {
    const result = sentiment.analyze(text);
    const label = result.score > 0 ? 'positive' : result.score < 0 ? 'negative' : 'neutral';
    
    return {
      score: result.score,
      comparative: result.comparative,
      label,
    };
  }

  extractKeywords(text: string): string[] {
    // Simple keyword extraction - would be enhanced with proper NLP
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    return words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  async analyzeReview(review: string): Promise<AnalysisResult> {
    const sentimentResult = this.analyzeSentiment(review);
    const keywords = this.extractKeywords(review);
    
    return {
      sentiment: sentimentResult,
      keywords,
      entities: [], // Would implement entity extraction
      topics: [], // Would implement topic modeling
      summary: review.slice(0, 100) + '...', // Would implement proper summarization
      insights: [`Overall sentiment is ${sentimentResult.label}`],
    };
  }

  async analyzeReviews(reviews: string[]): Promise<AnalysisResult[]> {
    return Promise.all(reviews.map(review => this.analyzeReview(review)));
  }
}

export default NLPEngine;