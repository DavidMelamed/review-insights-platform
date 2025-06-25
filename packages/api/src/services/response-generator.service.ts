import { Review } from '@prisma/client';
import { SentimentAnalyzer } from '../../../nlp-engine/src/sentiment-analyzer';
import { logger } from '../utils/logger';

export interface ResponseSuggestion {
  id: string;
  reviewId: string;
  responses: ResponseVariant[];
  metadata: ResponseMetadata;
  generatedAt: Date;
}

export interface ResponseVariant {
  tone: 'professional' | 'friendly' | 'empathetic' | 'apologetic';
  text: string;
  score: number; // AI confidence score
  keywords: string[]; // Key points addressed
  estimatedImpact: 'positive' | 'neutral' | 'negative';
}

export interface ResponseMetadata {
  reviewSentiment: string;
  reviewRating: number;
  issuesAddressed: string[];
  suggestedActions: string[];
  responseStrategy: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface ResponseTemplate {
  id: string;
  name: string;
  condition: (review: any) => boolean;
  template: string;
  variables: string[];
  tone: string;
}

export class ResponseGeneratorService {
  private sentimentAnalyzer = new SentimentAnalyzer();
  
  // Response templates based on scenarios
  private templates: ResponseTemplate[] = [
    {
      id: 'positive_general',
      name: 'Positive Review - General',
      condition: (review) => review.rating >= 4,
      template: `Thank you so much for your wonderful review, {customerName}! We're thrilled to hear that {positiveAspect}. Your feedback means the world to us and motivates our team to continue delivering exceptional {service/product}. We look forward to serving you again soon!`,
      variables: ['customerName', 'positiveAspect', 'service/product'],
      tone: 'friendly',
    },
    {
      id: 'negative_apologetic',
      name: 'Negative Review - Apologetic',
      condition: (review) => review.rating <= 2,
      template: `Dear {customerName}, we sincerely apologize for your disappointing experience with {issue}. This is not the standard we strive for, and we take your feedback very seriously. {actionTaken}. We'd love the opportunity to make this right. Please contact us at {contactInfo} so we can resolve this immediately.`,
      variables: ['customerName', 'issue', 'actionTaken', 'contactInfo'],
      tone: 'apologetic',
    },
    {
      id: 'constructive_feedback',
      name: 'Constructive Feedback',
      condition: (review) => review.rating === 3,
      template: `Thank you for taking the time to share your honest feedback, {customerName}. We appreciate you highlighting {positivePoint} and we understand your concerns about {improvementArea}. We're actively working on {solution} and your input helps us improve. We hope to exceed your expectations on your next visit.`,
      variables: ['customerName', 'positivePoint', 'improvementArea', 'solution'],
      tone: 'professional',
    },
    {
      id: 'feature_request',
      name: 'Feature Request Response',
      condition: (review) => review.content.toLowerCase().includes('wish') || review.content.toLowerCase().includes('would be nice'),
      template: `Hi {customerName}, thank you for your thoughtful suggestion about {featureRequest}! We love hearing ideas from our customers. I've shared this with our product team, and while I can't make any promises, we truly value input like yours that helps shape our future updates. Stay tuned for exciting developments!`,
      variables: ['customerName', 'featureRequest'],
      tone: 'friendly',
    },
  ];

  async generateResponses(review: Review): Promise<ResponseSuggestion> {
    // Analyze the review
    const sentiment = this.sentimentAnalyzer.analyzeSentiment(review.content);
    const complaints = this.sentimentAnalyzer.detectComplaints(review.content);
    const features = this.sentimentAnalyzer.detectFeatureRequests(review.content);

    // Extract key information
    const metadata = this.analyzeReviewMetadata(review, sentiment, complaints, features);

    // Generate response variants
    const responses = await this.generateResponseVariants(review, metadata);

    return {
      id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reviewId: review.id,
      responses,
      metadata,
      generatedAt: new Date(),
    };
  }

  private analyzeReviewMetadata(
    review: Review,
    sentiment: any,
    complaints: any,
    features: any
  ): ResponseMetadata {
    // Determine priority
    let priority: ResponseMetadata['priority'] = 'low';
    if (review.rating <= 2) priority = 'urgent';
    else if (review.rating === 3) priority = 'high';
    else if (complaints.isComplaint) priority = 'high';
    else if (review.verified && review.rating >= 4) priority = 'medium';

    // Identify issues
    const issuesAddressed: string[] = [];
    if (complaints.isComplaint) {
      issuesAddressed.push(complaints.category);
    }

    // Suggest actions
    const suggestedActions: string[] = [];
    if (review.rating <= 2) {
      suggestedActions.push('Immediate follow-up required');
      suggestedActions.push('Consider offering compensation');
    }
    if (complaints.isComplaint) {
      suggestedActions.push(complaints.suggestedAction || 'Address the complaint');
    }
    if (features.isFeatureRequest) {
      suggestedActions.push('Forward to product team');
    }

    // Determine strategy
    let responseStrategy = 'standard';
    if (review.rating <= 2) responseStrategy = 'damage_control';
    else if (review.rating >= 4) responseStrategy = 'amplify_positive';
    else if (features.isFeatureRequest) responseStrategy = 'acknowledge_feedback';

    return {
      reviewSentiment: sentiment.label,
      reviewRating: review.rating,
      issuesAddressed,
      suggestedActions,
      responseStrategy,
      priority,
    };
  }

  private async generateResponseVariants(
    review: Review,
    metadata: ResponseMetadata
  ): Promise<ResponseVariant[]> {
    const variants: ResponseVariant[] = [];

    // Generate based on templates
    for (const template of this.templates) {
      if (template.condition(review)) {
        const response = this.fillTemplate(template, review, metadata);
        variants.push({
          tone: template.tone as any,
          text: response,
          score: this.calculateConfidenceScore(review, template),
          keywords: this.extractKeywords(response),
          estimatedImpact: this.estimateImpact(review, template.tone),
        });
      }
    }

    // Generate custom variants based on sentiment
    if (metadata.reviewSentiment === 'negative') {
      variants.push(this.generateApologeticResponse(review, metadata));
      variants.push(this.generateEmpathicResponse(review, metadata));
    } else if (metadata.reviewSentiment === 'positive') {
      variants.push(this.generateAppreciativeResponse(review, metadata));
      variants.push(this.generateMarketingResponse(review, metadata));
    }

    // Sort by score
    return variants.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private fillTemplate(
    template: ResponseTemplate,
    review: Review,
    metadata: ResponseMetadata
  ): string {
    let response = template.template;

    // Extract values from review
    const values: Record<string, string> = {
      customerName: review.author || 'valued customer',
      positiveAspect: this.extractPositiveAspect(review.content),
      issue: metadata.issuesAddressed[0] || 'the situation',
      actionTaken: this.suggestAction(metadata),
      contactInfo: 'support@reviewinsights.ai',
      'service/product': 'service',
      positivePoint: this.extractPositivePoint(review.content),
      improvementArea: metadata.issuesAddressed[0] || 'certain aspects',
      solution: this.suggestSolution(metadata),
      featureRequest: this.extractFeatureRequest(review.content),
    };

    // Replace variables
    for (const [key, value] of Object.entries(values)) {
      response = response.replace(new RegExp(`{${key}}`, 'g'), value);
    }

    return response;
  }

  private generateApologeticResponse(
    review: Review,
    metadata: ResponseMetadata
  ): ResponseVariant {
    const issues = metadata.issuesAddressed.join(' and ');
    const text = `Dear ${review.author || 'valued customer'},

I want to personally apologize for your experience. ${review.content.substring(0, 50)}... clearly shows we fell short of expectations.

We take full responsibility for ${issues || 'this situation'}. I've immediately:
- Shared your feedback with our team
- Initiated a review of our processes
- Flagged this for priority resolution

Your experience matters deeply to us. Please reach out directly at support@reviewinsights.ai or call 1-800-REVIEWS so I can personally ensure we make this right.

We value your business and hope to restore your trust.

Sincerely,
Customer Success Team`;

    return {
      tone: 'apologetic',
      text,
      score: 0.9,
      keywords: ['apologize', 'responsibility', 'resolution', 'personally'],
      estimatedImpact: 'positive',
    };
  }

  private generateEmpathicResponse(
    review: Review,
    metadata: ResponseMetadata
  ): ResponseVariant {
    const text = `Hi ${review.author || 'there'},

I completely understand your frustration. Nobody should have to experience what you described, and I can imagine how disappointing this must have been.

You deserve better, and we want to make it right. Here's what we're doing:
1. Investigating exactly what went wrong
2. Implementing immediate improvements
3. Ensuring this doesn't happen again

Could we connect directly? I'd like to hear more about your experience and personally oversee a resolution. Please email me at manager@reviewinsights.ai.

Thank you for bringing this to our attention. Your feedback helps us improve.`;

    return {
      tone: 'empathetic',
      text,
      score: 0.85,
      keywords: ['understand', 'frustration', 'deserve', 'improve'],
      estimatedImpact: 'positive',
    };
  }

  private generateAppreciativeResponse(
    review: Review,
    metadata: ResponseMetadata
  ): ResponseVariant {
    const positiveAspects = this.extractPositiveAspects(review.content);
    const text = `Thank you so much, ${review.author || 'friend'}! 🌟

Your review just made our day! We're absolutely thrilled that ${positiveAspects || 'you had such a positive experience'}.

It's customers like you who inspire us to keep pushing boundaries and delivering our best every single day. We've shared your kind words with our entire team - they're beaming!

Can't wait to welcome you back soon. And hey, if you have friends who'd love what we do, we'd be honored if you'd spread the word!

With gratitude,
The ${review.source} Team`;

    return {
      tone: 'friendly',
      text,
      score: 0.95,
      keywords: ['thank', 'thrilled', 'inspire', 'gratitude'],
      estimatedImpact: 'positive',
    };
  }

  private generateMarketingResponse(
    review: Review,
    metadata: ResponseMetadata
  ): ResponseVariant {
    const text = `Wow, ${review.author || 'superstar'}! Thank you for this amazing review! 🎉

We're beyond excited that you loved ${this.extractPositiveAspect(review.content)}. Your experience is exactly what we aim for every single time.

As a thank you for being such an incredible customer and taking time to share your experience, we'd love to offer you 15% off your next visit. Just mention this review!

P.S. We'd be thrilled if you'd share your experience with friends who might love us too! 

See you soon!
Team Awesome ✨`;

    return {
      tone: 'friendly',
      text,
      score: 0.88,
      keywords: ['amazing', 'thank', 'offer', 'share'],
      estimatedImpact: 'positive',
    };
  }

  // Helper methods
  private extractPositiveAspect(content: string): string {
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love'];
    const sentences = content.split(/[.!?]/);
    
    for (const sentence of sentences) {
      for (const word of positiveWords) {
        if (sentence.toLowerCase().includes(word)) {
          return sentence.trim();
        }
      }
    }
    
    return 'you had a positive experience';
  }

  private extractPositiveAspects(content: string): string {
    const aspects = this.extractPositiveAspect(content);
    return aspects.length > 50 ? aspects.substring(0, 50) + '...' : aspects;
  }

  private extractPositivePoint(content: string): string {
    // Simple extraction - in production would use NLP
    const sentences = content.split(/[.!?]/);
    return sentences[0]?.trim() || 'your experience';
  }

  private extractFeatureRequest(content: string): string {
    const patterns = [
      /would be (nice|great) if (.+)/i,
      /wish (?:they|you) (?:had|could) (.+)/i,
      /should (?:have|add) (.+)/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1] || match[2] || 'the suggested feature';
      }
    }

    return 'your suggestion';
  }

  private suggestAction(metadata: ResponseMetadata): string {
    if (metadata.suggestedActions.length > 0) {
      return metadata.suggestedActions[0];
    }
    return 'We are reviewing our procedures to prevent this';
  }

  private suggestSolution(metadata: ResponseMetadata): string {
    const solutions: Record<string, string> = {
      quality: 'improving our quality control processes',
      service: 'enhancing our customer service training',
      pricing: 'reviewing our pricing strategy',
      speed: 'optimizing our service delivery',
    };

    const issue = metadata.issuesAddressed[0];
    return solutions[issue] || 'making improvements based on your feedback';
  }

  private calculateConfidenceScore(review: Review, template: ResponseTemplate): number {
    let score = 0.7; // Base score

    // Adjust based on review characteristics
    if (review.verified) score += 0.1;
    if (review.rating <= 2 && template.tone === 'apologetic') score += 0.15;
    if (review.rating >= 4 && template.tone === 'friendly') score += 0.15;
    
    return Math.min(score, 1.0);
  }

  private extractKeywords(response: string): string[] {
    const keywords: string[] = [];
    const importantWords = [
      'apologize', 'sorry', 'thank', 'appreciate', 'improve',
      'resolve', 'personally', 'immediately', 'guarantee', 'ensure',
    ];

    for (const word of importantWords) {
      if (response.toLowerCase().includes(word)) {
        keywords.push(word);
      }
    }

    return keywords;
  }

  private estimateImpact(review: Review, tone: string): 'positive' | 'neutral' | 'negative' {
    if (review.rating <= 2 && ['apologetic', 'empathetic'].includes(tone)) {
      return 'positive'; // Good recovery attempt
    }
    if (review.rating >= 4 && tone === 'friendly') {
      return 'positive'; // Reinforcing positive experience
    }
    return 'neutral';
  }

  // Batch processing for efficiency
  async generateBulkResponses(reviews: Review[]): Promise<ResponseSuggestion[]> {
    const responses = await Promise.all(
      reviews.map(review => this.generateResponses(review))
    );
    return responses;
  }

  // Learn from accepted/rejected responses
  async recordResponseFeedback(
    responseId: string,
    accepted: boolean,
    actualResponse?: string
  ): Promise<void> {
    // In production, this would update ML models
    logger.info('Response feedback recorded', {
      responseId,
      accepted,
      hasActualResponse: !!actualResponse,
    });
  }
}