import { ReviewData } from '../../scraper/src/dataforseo-client';

export interface SentimentResult {
  score: number; // -1 to 1
  magnitude: number; // 0 to 1
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
}

export interface AspectSentiment {
  aspect: string;
  sentiment: SentimentResult;
  mentions: number;
  examples: string[];
}

export interface ComplaintDetection {
  isComplaint: boolean;
  severity: 'low' | 'medium' | 'high';
  category: string;
  keywords: string[];
  suggestedAction?: string;
}

export interface FeatureRequest {
  isFeatureRequest: boolean;
  feature: string;
  priority: 'low' | 'medium' | 'high';
  frequency: number;
}

export class SentimentAnalyzer {
  private complaintPatterns = [
    { pattern: /broken|defective|malfunction/i, category: 'quality', severity: 'high' },
    { pattern: /slow|delay|late|waiting/i, category: 'service', severity: 'medium' },
    { pattern: /rude|unprofessional|disrespectful/i, category: 'staff', severity: 'high' },
    { pattern: /expensive|overpriced|costly/i, category: 'pricing', severity: 'low' },
    { pattern: /dirty|unclean|messy/i, category: 'cleanliness', severity: 'medium' },
  ];

  private featureRequestPatterns = [
    /would be (nice|great|better) if/i,
    /wish (they|you|it) (had|could|would)/i,
    /please add|please include/i,
    /missing feature|lacking/i,
    /should have|needs to have/i,
  ];

  private positiveWords = new Set([
    'excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'good',
    'love', 'perfect', 'best', 'outstanding', 'exceptional', 'superb',
    'impressed', 'satisfied', 'recommend', 'friendly', 'helpful',
  ]);

  private negativeWords = new Set([
    'terrible', 'awful', 'horrible', 'bad', 'poor', 'worst', 'hate',
    'disappointed', 'frustrating', 'annoying', 'unacceptable', 'waste',
    'never', 'avoid', 'regret', 'problem', 'issue', 'complaint',
  ]);

  analyzeSentiment(text: string): SentimentResult {
    const words = text.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;

    // Count positive and negative words
    for (const word of words) {
      if (this.positiveWords.has(word)) {
        positiveScore++;
      }
      if (this.negativeWords.has(word)) {
        negativeScore++;
      }
    }

    // Check for negation
    const negationPattern = /not|no|never|neither|nor|n't/i;
    const hasNegation = negationPattern.test(text);

    if (hasNegation) {
      // Swap scores if negation is present
      [positiveScore, negativeScore] = [negativeScore, positiveScore];
    }

    // Calculate sentiment score
    const totalWords = words.length;
    const sentimentScore = (positiveScore - negativeScore) / Math.max(totalWords, 1);
    const magnitude = (positiveScore + negativeScore) / Math.max(totalWords, 1);

    // Determine label
    let label: SentimentResult['label'];
    if (sentimentScore > 0.1) {
      label = 'positive';
    } else if (sentimentScore < -0.1) {
      label = 'negative';
    } else if (magnitude > 0.1) {
      label = 'mixed';
    } else {
      label = 'neutral';
    }

    // Calculate confidence based on magnitude and text length
    const confidence = Math.min(magnitude * 2 + (totalWords > 20 ? 0.2 : 0), 1);

    return {
      score: Math.max(-1, Math.min(1, sentimentScore)),
      magnitude: Math.min(1, magnitude),
      label,
      confidence,
    };
  }

  analyzeAspects(reviews: ReviewData[]): AspectSentiment[] {
    const aspectMap = new Map<string, { sentiment: number[], examples: string[] }>();
    
    const aspectKeywords = {
      'service': ['service', 'staff', 'employee', 'help', 'support'],
      'quality': ['quality', 'product', 'material', 'build', 'durability'],
      'price': ['price', 'cost', 'value', 'expensive', 'cheap', 'affordable'],
      'location': ['location', 'place', 'area', 'parking', 'access'],
      'atmosphere': ['atmosphere', 'ambiance', 'environment', 'vibe', 'decor'],
      'speed': ['fast', 'quick', 'slow', 'wait', 'time', 'delivery'],
    };

    for (const review of reviews) {
      const text = review.content.toLowerCase();
      
      for (const [aspect, keywords] of Object.entries(aspectKeywords)) {
        if (keywords.some(keyword => text.includes(keyword))) {
          if (!aspectMap.has(aspect)) {
            aspectMap.set(aspect, { sentiment: [], examples: [] });
          }
          
          const sentiment = this.analyzeSentiment(review.content);
          const data = aspectMap.get(aspect)!;
          data.sentiment.push(sentiment.score);
          
          if (data.examples.length < 3) {
            data.examples.push(review.content.substring(0, 100) + '...');
          }
        }
      }
    }

    const results: AspectSentiment[] = [];
    
    for (const [aspect, data] of aspectMap.entries()) {
      const avgScore = data.sentiment.reduce((a, b) => a + b, 0) / data.sentiment.length;
      const sentiment = this.analyzeSentiment(aspect); // Dummy call to get structure
      sentiment.score = avgScore;
      sentiment.label = avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral';
      
      results.push({
        aspect,
        sentiment,
        mentions: data.sentiment.length,
        examples: data.examples,
      });
    }

    return results.sort((a, b) => b.mentions - a.mentions);
  }

  detectComplaints(text: string): ComplaintDetection {
    let isComplaint = false;
    let severity: ComplaintDetection['severity'] = 'low';
    let category = 'general';
    const keywords: string[] = [];

    for (const { pattern, category: cat, severity: sev } of this.complaintPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        isComplaint = true;
        category = cat;
        severity = sev;
        keywords.push(...matches);
      }
    }

    // Additional complaint detection based on sentiment
    const sentiment = this.analyzeSentiment(text);
    if (sentiment.label === 'negative' && sentiment.confidence > 0.7) {
      isComplaint = true;
      if (sentiment.score < -0.5) {
        severity = 'high';
      }
    }

    let suggestedAction;
    if (isComplaint) {
      switch (category) {
        case 'quality':
          suggestedAction = 'Investigate product quality issues and contact customer for replacement';
          break;
        case 'service':
          suggestedAction = 'Review service procedures and provide additional staff training';
          break;
        case 'staff':
          suggestedAction = 'Address staff behavior immediately and follow up with customer';
          break;
        case 'pricing':
          suggestedAction = 'Review pricing strategy and consider promotional offers';
          break;
        case 'cleanliness':
          suggestedAction = 'Schedule immediate cleaning and implement regular inspections';
          break;
        default:
          suggestedAction = 'Contact customer to understand and resolve the issue';
      }
    }

    return {
      isComplaint,
      severity,
      category,
      keywords: [...new Set(keywords)],
      suggestedAction,
    };
  }

  detectFeatureRequests(text: string): FeatureRequest {
    let isFeatureRequest = false;
    let feature = '';
    let priority: FeatureRequest['priority'] = 'low';

    for (const pattern of this.featureRequestPatterns) {
      const match = text.match(pattern);
      if (match) {
        isFeatureRequest = true;
        
        // Extract the feature description
        const sentences = text.split(/[.!?]/);
        for (const sentence of sentences) {
          if (pattern.test(sentence)) {
            feature = sentence.trim();
            break;
          }
        }
      }
    }

    // Determine priority based on sentiment and keywords
    if (isFeatureRequest) {
      if (/essential|critical|must have|need/i.test(text)) {
        priority = 'high';
      } else if (/would be nice|should|could/i.test(text)) {
        priority = 'medium';
      }
    }

    return {
      isFeatureRequest,
      feature: feature.substring(0, 200),
      priority,
      frequency: 1, // Will be aggregated later
    };
  }

  analyzeReviewBatch(reviews: ReviewData[]): {
    overallSentiment: SentimentResult;
    aspectSentiments: AspectSentiment[];
    complaints: ComplaintDetection[];
    featureRequests: FeatureRequest[];
  } {
    // Overall sentiment
    const sentiments = reviews.map(r => this.analyzeSentiment(r.content));
    const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
    const avgMagnitude = sentiments.reduce((sum, s) => sum + s.magnitude, 0) / sentiments.length;
    
    const overallSentiment: SentimentResult = {
      score: avgScore,
      magnitude: avgMagnitude,
      label: avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral',
      confidence: avgMagnitude,
    };

    // Analyze aspects
    const aspectSentiments = this.analyzeAspects(reviews);

    // Detect complaints and feature requests
    const complaints: ComplaintDetection[] = [];
    const featureRequests: FeatureRequest[] = [];
    const featureMap = new Map<string, FeatureRequest>();

    for (const review of reviews) {
      const complaint = this.detectComplaints(review.content);
      if (complaint.isComplaint) {
        complaints.push(complaint);
      }

      const featureReq = this.detectFeatureRequests(review.content);
      if (featureReq.isFeatureRequest) {
        const key = featureReq.feature.toLowerCase();
        if (featureMap.has(key)) {
          featureMap.get(key)!.frequency++;
        } else {
          featureMap.set(key, featureReq);
        }
      }
    }

    return {
      overallSentiment,
      aspectSentiments,
      complaints,
      featureRequests: Array.from(featureMap.values())
        .sort((a, b) => b.frequency - a.frequency),
    };
  }
}