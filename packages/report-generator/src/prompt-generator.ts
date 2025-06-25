import { Insight, Recommendation } from './report-builder';
import { 
  SentimentResult, 
  AspectSentiment, 
  ComplaintDetection, 
  FeatureRequest 
} from '../../nlp-engine/src/sentiment-analyzer';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'marketing' | 'product' | 'customer-service' | 'executive';
}

export interface GeneratedPrompt {
  id: string;
  templateId: string;
  purpose: string;
  prompt: string;
  context: any;
  metadata: {
    generatedAt: Date;
    insightCount: number;
    dataPoints: number;
  };
}

export class PromptGenerator {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates() {
    // Marketing Copy Template
    this.templates.set('marketing_copy', {
      id: 'marketing_copy',
      name: 'Marketing Copy Generator',
      description: 'Generate marketing copy based on positive customer feedback',
      template: `You are a direct response copywriter creating compelling marketing copy.

CUSTOMER INSIGHTS:
${'{positiveAspects}'}

TOP CUSTOMER QUOTES:
${'{customerQuotes}'}

KEY VALUE PROPOSITIONS:
${'{valueProps}'}

SENTIMENT ANALYSIS:
- Overall sentiment: ${'{overallSentiment}'}
- Top positive aspects: ${'{topAspects}'}

TASK: Write compelling marketing copy that:
1. Highlights what customers love most
2. Uses their exact language and phrases
3. Addresses any mentioned concerns proactively
4. Creates urgency and desire
5. Includes specific benefits customers mentioned

Format: Create headlines, subheadlines, and body copy for [specify medium: landing page/email/ad]`,
      variables: ['positiveAspects', 'customerQuotes', 'valueProps', 'overallSentiment', 'topAspects'],
      category: 'marketing',
    });

    // Product Development Template
    this.templates.set('product_roadmap', {
      id: 'product_roadmap',
      name: 'Product Roadmap Prioritizer',
      description: 'Prioritize product features based on customer requests',
      template: `You are a product manager analyzing customer feedback to prioritize the roadmap.

FEATURE REQUESTS (sorted by frequency):
${'{featureRequests}'}

CUSTOMER COMPLAINTS:
${'{complaints}'}

COMPETITIVE MENTIONS:
${'{competitorMentions}'}

USAGE CONTEXT:
${'{usageContext}'}

TASK: Create a prioritized product roadmap that:
1. Addresses the most requested features
2. Solves the biggest customer pain points
3. Maintains competitive advantage
4. Balances quick wins with long-term vision
5. Includes success metrics for each feature

Provide reasoning for prioritization and estimated impact.`,
      variables: ['featureRequests', 'complaints', 'competitorMentions', 'usageContext'],
      category: 'product',
    });

    // Customer Service Response Template
    this.templates.set('cs_response', {
      id: 'cs_response',
      name: 'Customer Service Response Generator',
      description: 'Generate empathetic responses to customer complaints',
      template: `You are a customer service expert crafting responses to customer concerns.

COMMON COMPLAINTS:
${'{complaintPatterns}'}

SUCCESSFUL RESOLUTIONS:
${'{resolutionExamples}'}

BRAND VOICE GUIDELINES:
${'{brandVoice}'}

SENTIMENT CONTEXT:
${'{sentimentContext}'}

TASK: Create response templates that:
1. Acknowledge the specific concern with empathy
2. Provide clear solution steps
3. Offer compensation/remediation when appropriate
4. Prevent escalation
5. Turn dissatisfied customers into advocates

Include variations for different severity levels.`,
      variables: ['complaintPatterns', 'resolutionExamples', 'brandVoice', 'sentimentContext'],
      category: 'customer-service',
    });

    // Executive Strategy Template
    this.templates.set('executive_brief', {
      id: 'executive_brief',
      name: 'Executive Strategy Brief',
      description: 'Generate strategic recommendations for executives',
      template: `You are a strategic advisor preparing an executive brief based on customer intelligence.

MARKET POSITION:
${'{marketPosition}'}

KEY INSIGHTS:
${'{keyInsights}'}

COMPETITIVE LANDSCAPE:
${'{competitiveLandscape}'}

RISKS & OPPORTUNITIES:
${'{risksOpportunities}'}

FINANCIAL IMPACT ESTIMATES:
${'{financialImpact}'}

TASK: Create an executive brief that:
1. Summarizes the current state in 3 bullet points
2. Identifies 3 strategic priorities based on data
3. Recommends specific actions with timelines
4. Quantifies potential impact on revenue/retention
5. Highlights competitive advantages to leverage

Keep it concise and action-oriented.`,
      variables: ['marketPosition', 'keyInsights', 'competitiveLandscape', 'risksOpportunities', 'financialImpact'],
      category: 'executive',
    });
  }

  generatePrompt(
    templateId: string,
    data: {
      insights: Insight[];
      recommendations: Recommendation[];
      sentiment: {
        overall: SentimentResult;
        aspects: AspectSentiment[];
        complaints: ComplaintDetection[];
        featureRequests: FeatureRequest[];
      };
      quotes: any[];
      brandInfo: any;
    }
  ): GeneratedPrompt {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const variables = this.extractVariables(template, data);
    let prompt = template.template;

    // Replace variables in template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `\${'{${key}}'}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    });

    return {
      id: `prompt_${Date.now()}`,
      templateId,
      purpose: template.description,
      prompt,
      context: {
        dataUsed: {
          insights: data.insights.length,
          recommendations: data.recommendations.length,
          complaints: data.sentiment.complaints.length,
          featureRequests: data.sentiment.featureRequests.length,
        },
      },
      metadata: {
        generatedAt: new Date(),
        insightCount: data.insights.length,
        dataPoints: this.countDataPoints(data),
      },
    };
  }

  generateAllPrompts(data: any): GeneratedPrompt[] {
    const prompts: GeneratedPrompt[] = [];

    // Generate prompts for each template
    for (const [templateId] of this.templates) {
      try {
        const prompt = this.generatePrompt(templateId, data);
        prompts.push(prompt);
      } catch (error) {
        console.error(`Failed to generate prompt for ${templateId}:`, error);
      }
    }

    return prompts;
  }

  private extractVariables(template: PromptTemplate, data: any): Record<string, string> {
    const variables: Record<string, string> = {};

    template.variables.forEach(varName => {
      switch (varName) {
        case 'positiveAspects':
          variables[varName] = this.formatPositiveAspects(data.sentiment.aspects);
          break;
        
        case 'customerQuotes':
          variables[varName] = this.formatCustomerQuotes(data.quotes);
          break;
        
        case 'valueProps':
          variables[varName] = this.extractValuePropositions(data.insights);
          break;
        
        case 'overallSentiment':
          variables[varName] = this.formatSentiment(data.sentiment.overall);
          break;
        
        case 'topAspects':
          variables[varName] = this.formatTopAspects(data.sentiment.aspects);
          break;
        
        case 'featureRequests':
          variables[varName] = this.formatFeatureRequests(data.sentiment.featureRequests);
          break;
        
        case 'complaints':
          variables[varName] = this.formatComplaints(data.sentiment.complaints);
          break;
        
        case 'competitorMentions':
          variables[varName] = this.formatCompetitorMentions(data);
          break;
        
        case 'complaintPatterns':
          variables[varName] = this.analyzeComplaintPatterns(data.sentiment.complaints);
          break;
        
        case 'keyInsights':
          variables[varName] = this.formatKeyInsights(data.insights);
          break;
        
        case 'marketPosition':
          variables[varName] = this.analyzeMarketPosition(data);
          break;
        
        case 'risksOpportunities':
          variables[varName] = this.identifyRisksOpportunities(data);
          break;
        
        default:
          variables[varName] = 'No data available';
      }
    });

    return variables;
  }

  private formatPositiveAspects(aspects: AspectSentiment[]): string {
    return aspects
      .filter(a => a.sentiment.label === 'positive')
      .map(a => `- ${a.aspect}: ${a.mentions} positive mentions (${(a.sentiment.score * 100).toFixed(0)}% positive)`)
      .join('\n');
  }

  private formatCustomerQuotes(quotes: any[]): string {
    return quotes
      .map(q => `"${q.text}" - ${q.author}`)
      .join('\n\n');
  }

  private extractValuePropositions(insights: Insight[]): string {
    return insights
      .filter(i => i.impact === 'high' && i.category === 'brand-perception')
      .map(i => `- ${i.title}: ${i.description}`)
      .join('\n');
  }

  private formatSentiment(sentiment: SentimentResult): string {
    return `${sentiment.label} (${(sentiment.score * 100).toFixed(1)}% with ${(sentiment.confidence * 100).toFixed(0)}% confidence)`;
  }

  private formatTopAspects(aspects: AspectSentiment[]): string {
    return aspects
      .slice(0, 5)
      .map(a => `${a.aspect} (${a.sentiment.label})`)
      .join(', ');
  }

  private formatFeatureRequests(requests: FeatureRequest[]): string {
    return requests
      .map(r => `- ${r.feature} (Requested ${r.frequency} times, Priority: ${r.priority})`)
      .join('\n');
  }

  private formatComplaints(complaints: ComplaintDetection[]): string {
    const grouped = this.groupComplaintsByCategory(complaints);
    return Object.entries(grouped)
      .map(([category, items]) => `- ${category}: ${items.length} complaints (${items[0].severity} severity)`)
      .join('\n');
  }

  private formatCompetitorMentions(data: any): string {
    // Would extract from reviews mentioning competitors
    return 'Competitor analysis based on customer mentions';
  }

  private analyzeComplaintPatterns(complaints: ComplaintDetection[]): string {
    const patterns = new Map<string, number>();
    
    complaints.forEach(c => {
      c.keywords.forEach(keyword => {
        patterns.set(keyword, (patterns.get(keyword) || 0) + 1);
      });
    });

    return Array.from(patterns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([keyword, count]) => `- "${keyword}" mentioned ${count} times`)
      .join('\n');
  }

  private formatKeyInsights(insights: Insight[]): string {
    return insights
      .slice(0, 5)
      .map(i => `- ${i.title}: ${i.description} (Impact: ${i.impact})`)
      .join('\n');
  }

  private analyzeMarketPosition(data: any): string {
    const sentiment = data.sentiment.overall;
    const position = sentiment.score > 0.5 ? 'Market Leader' : 
                    sentiment.score > 0 ? 'Competitive' : 
                    'Needs Improvement';
    
    return `${position} - Overall sentiment: ${this.formatSentiment(sentiment)}`;
  }

  private identifyRisksOpportunities(data: any): string {
    const risks: string[] = [];
    const opportunities: string[] = [];

    // Identify risks from complaints
    if (data.sentiment.complaints.length > 10) {
      risks.push('High complaint volume indicates customer satisfaction issues');
    }

    // Identify opportunities from feature requests
    if (data.sentiment.featureRequests.length > 5) {
      opportunities.push('Strong customer engagement with product development ideas');
    }

    return `RISKS:\n${risks.map(r => `- ${r}`).join('\n')}\n\nOPPORTUNITIES:\n${opportunities.map(o => `- ${o}`).join('\n')}`;
  }

  private groupComplaintsByCategory(complaints: ComplaintDetection[]): Record<string, ComplaintDetection[]> {
    return complaints.reduce((acc, complaint) => {
      if (!acc[complaint.category]) {
        acc[complaint.category] = [];
      }
      acc[complaint.category].push(complaint);
      return acc;
    }, {} as Record<string, ComplaintDetection[]>);
  }

  private countDataPoints(data: any): number {
    return (
      data.insights.length +
      data.recommendations.length +
      data.sentiment.complaints.length +
      data.sentiment.featureRequests.length +
      data.sentiment.aspects.length
    );
  }

  getAvailableTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplateById(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }
}