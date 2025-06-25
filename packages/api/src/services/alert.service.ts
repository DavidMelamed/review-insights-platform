import { prisma } from '../database';
import { sendEmail } from '../utils/email';
import { WebhookService } from './webhook.service';
import { SlackService } from './slack.service';
import { Review, User } from '@prisma/client';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  actions: AlertAction[];
  enabled: boolean;
  cooldownMinutes?: number;
}

export interface AlertCondition {
  type: 'rating' | 'sentiment' | 'volume' | 'keyword' | 'competitor';
  operator: 'equals' | 'less_than' | 'greater_than' | 'contains';
  value: number | string;
  timeWindowMinutes?: number;
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
}

export interface AlertEvent {
  ruleId: string;
  triggeredAt: Date;
  data: any;
  review?: Review;
}

export class AlertService {
  private webhookService = new WebhookService();
  private slackService = new SlackService();
  private lastAlertTimes = new Map<string, Date>();

  // Predefined alert rules
  private defaultRules: AlertRule[] = [
    {
      id: 'negative_review',
      name: 'Negative Review Alert',
      description: 'Triggered when a review with 1-2 stars is received',
      condition: {
        type: 'rating',
        operator: 'less_than',
        value: 3,
      },
      actions: [
        {
          type: 'email',
          config: { template: 'negative_review' }
        }
      ],
      enabled: true,
      cooldownMinutes: 0, // Alert for every negative review
    },
    {
      id: 'review_spike',
      name: 'Review Volume Spike',
      description: 'Triggered when review volume increases by 50% in 1 hour',
      condition: {
        type: 'volume',
        operator: 'greater_than',
        value: 1.5, // 150% of normal
        timeWindowMinutes: 60,
      },
      actions: [
        {
          type: 'email',
          config: { template: 'volume_spike' }
        },
        {
          type: 'slack',
          config: { channel: '#alerts' }
        }
      ],
      enabled: true,
      cooldownMinutes: 60,
    },
    {
      id: 'competitor_mention',
      name: 'Competitor Mentioned',
      description: 'Triggered when a competitor is mentioned in a review',
      condition: {
        type: 'keyword',
        operator: 'contains',
        value: 'competitor_keywords', // Will be replaced with actual keywords
      },
      actions: [
        {
          type: 'slack',
          config: { channel: '#competitive-intel' }
        }
      ],
      enabled: true,
      cooldownMinutes: 30,
    },
    {
      id: 'crisis_detection',
      name: 'Crisis Detection',
      description: 'Multiple negative reviews in short time period',
      condition: {
        type: 'sentiment',
        operator: 'less_than',
        value: -0.5,
        timeWindowMinutes: 30,
      },
      actions: [
        {
          type: 'email',
          config: { template: 'crisis_alert', priority: 'high' }
        },
        {
          type: 'slack',
          config: { channel: '#crisis-management', mention: '@channel' }
        },
        {
          type: 'webhook',
          config: { url: 'crisis_webhook_url' }
        }
      ],
      enabled: true,
      cooldownMinutes: 120,
    },
  ];

  async checkAlerts(review: Review, userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) return;

    // Get user's custom rules + default rules
    const rules = await this.getUserAlertRules(userId);

    for (const rule of rules) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (!this.checkCooldown(rule)) continue;

      // Evaluate condition
      const triggered = await this.evaluateCondition(rule.condition, review, userId);
      
      if (triggered) {
        await this.triggerAlert(rule, review, user);
      }
    }
  }

  private async evaluateCondition(
    condition: AlertCondition,
    review: Review,
    userId: string
  ): Promise<boolean> {
    switch (condition.type) {
      case 'rating':
        return this.evaluateNumericCondition(
          review.rating,
          condition.operator as any,
          condition.value as number
        );

      case 'sentiment':
        const sentimentScore = review.sentimentScore || 0;
        return this.evaluateNumericCondition(
          sentimentScore,
          condition.operator as any,
          condition.value as number
        );

      case 'volume':
        const volumeRatio = await this.calculateVolumeRatio(
          userId,
          condition.timeWindowMinutes || 60
        );
        return this.evaluateNumericCondition(
          volumeRatio,
          condition.operator as any,
          condition.value as number
        );

      case 'keyword':
        const keywords = await this.getKeywords(condition.value as string, userId);
        return keywords.some(keyword => 
          review.content.toLowerCase().includes(keyword.toLowerCase())
        );

      case 'competitor':
        const competitors = await this.getCompetitorNames(userId);
        return competitors.some(competitor =>
          review.content.toLowerCase().includes(competitor.toLowerCase())
        );

      default:
        return false;
    }
  }

  private evaluateNumericCondition(
    actual: number,
    operator: 'equals' | 'less_than' | 'greater_than',
    expected: number
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'less_than':
        return actual < expected;
      case 'greater_than':
        return actual > expected;
      default:
        return false;
    }
  }

  private async calculateVolumeRatio(
    userId: string,
    timeWindowMinutes: number
  ): Promise<number> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);
    const previousWindowStart = new Date(windowStart.getTime() - timeWindowMinutes * 60 * 1000);

    // Current window count
    const currentCount = await prisma.review.count({
      where: {
        collection: { userId },
        createdAt: { gte: windowStart },
      },
    });

    // Previous window count
    const previousCount = await prisma.review.count({
      where: {
        collection: { userId },
        createdAt: {
          gte: previousWindowStart,
          lt: windowStart,
        },
      },
    });

    return previousCount > 0 ? currentCount / previousCount : currentCount;
  }

  private async triggerAlert(
    rule: AlertRule,
    review: Review,
    user: User
  ): Promise<void> {
    // Update last alert time
    this.lastAlertTimes.set(rule.id, new Date());

    // Create alert event
    const event: AlertEvent = {
      ruleId: rule.id,
      triggeredAt: new Date(),
      data: {
        ruleName: rule.name,
        reviewId: review.id,
        rating: review.rating,
        sentiment: review.sentimentScore,
      },
      review,
    };

    // Execute actions
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, event, user);
      } catch (error) {
        console.error(`Failed to execute alert action: ${action.type}`, error);
      }
    }

    // Log alert
    await prisma.usageRecord.create({
      data: {
        userId: user.id,
        action: 'alert_triggered',
        credits: 0,
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          reviewId: review.id,
        },
      },
    });
  }

  private async executeAction(
    action: AlertAction,
    event: AlertEvent,
    user: User
  ): Promise<void> {
    switch (action.type) {
      case 'email':
        await this.sendEmailAlert(event, user, action.config);
        break;
      
      case 'slack':
        await this.sendSlackAlert(event, user, action.config);
        break;
      
      case 'webhook':
        await this.sendWebhookAlert(event, user, action.config);
        break;
      
      case 'sms':
        // SMS implementation would go here
        break;
    }
  }

  private async sendEmailAlert(
    event: AlertEvent,
    user: User,
    config: Record<string, any>
  ): Promise<void> {
    const template = config.template || 'default_alert';
    const priority = config.priority || 'normal';

    await sendEmail({
      to: user.email,
      subject: `[${priority.toUpperCase()}] Alert: ${event.data.ruleName}`,
      html: this.generateEmailContent(event, template),
    });
  }

  private async sendSlackAlert(
    event: AlertEvent,
    user: User,
    config: Record<string, any>
  ): Promise<void> {
    const channel = config.channel || '#alerts';
    const mention = config.mention || '';

    await this.slackService.sendMessage({
      channel,
      text: `${mention} Alert: ${event.data.ruleName}`,
      attachments: [
        {
          color: event.review?.rating && event.review.rating <= 2 ? 'danger' : 'warning',
          fields: [
            {
              title: 'Rating',
              value: event.review?.rating?.toString() || 'N/A',
              short: true,
            },
            {
              title: 'Source',
              value: event.review?.source || 'Unknown',
              short: true,
            },
            {
              title: 'Review',
              value: event.review?.content?.substring(0, 200) + '...' || 'No content',
              short: false,
            },
          ],
          timestamp: event.triggeredAt.toISOString(),
        },
      ],
    });
  }

  private async sendWebhookAlert(
    event: AlertEvent,
    user: User,
    config: Record<string, any>
  ): Promise<void> {
    const url = config.url || await this.getUserWebhookUrl(user.id);
    
    await this.webhookService.send(url, {
      event: 'alert.triggered',
      data: event,
      timestamp: new Date().toISOString(),
    });
  }

  private checkCooldown(rule: AlertRule): boolean {
    if (!rule.cooldownMinutes) return true;

    const lastAlert = this.lastAlertTimes.get(rule.id);
    if (!lastAlert) return true;

    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert.getTime() > cooldownMs;
  }

  private async getUserAlertRules(userId: string): Promise<AlertRule[]> {
    // In a real implementation, fetch user's custom rules from database
    // For now, return default rules
    return this.defaultRules;
  }

  private async getKeywords(keywordSet: string, userId: string): Promise<string[]> {
    // In real implementation, fetch from user's keyword sets
    const keywordSets: Record<string, string[]> = {
      competitor_keywords: ['competitor1', 'rival brand', 'alternative'],
      crisis_keywords: ['scam', 'fraud', 'lawsuit', 'dangerous', 'recall'],
      feature_keywords: ['wish', 'would be nice', 'missing', 'need', 'want'],
    };

    return keywordSets[keywordSet] || [];
  }

  private async getCompetitorNames(userId: string): Promise<string[]> {
    // In real implementation, fetch from user's competitor list
    return ['CompetitorA', 'CompetitorB', 'CompetitorC'];
  }

  private async getUserWebhookUrl(userId: string): Promise<string> {
    // In real implementation, fetch from user settings
    return 'https://example.com/webhook';
  }

  private generateEmailContent(event: AlertEvent, template: string): string {
    // Templates for different alert types
    const templates: Record<string, string> = {
      negative_review: `
        <h2>Negative Review Alert</h2>
        <p>A new negative review has been posted:</p>
        <div style="border-left: 4px solid #ef4444; padding-left: 16px; margin: 16px 0;">
          <p><strong>Rating:</strong> ${event.review?.rating}/5</p>
          <p><strong>Source:</strong> ${event.review?.source}</p>
          <p><strong>Review:</strong></p>
          <p style="color: #6b7280;">${event.review?.content}</p>
        </div>
        <p><a href="${process.env.FRONTEND_URL}/dashboard/reviews/${event.review?.id}" style="background-color: #4f46e5; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Review</a></p>
      `,
      volume_spike: `
        <h2>Review Volume Spike Detected</h2>
        <p>There has been an unusual increase in review volume.</p>
        <p>This could indicate:</p>
        <ul>
          <li>A viral social media mention</li>
          <li>A marketing campaign effect</li>
          <li>A potential review bombing attempt</li>
        </ul>
        <p><a href="${process.env.FRONTEND_URL}/dashboard/analytics">View Analytics</a></p>
      `,
      crisis_alert: `
        <h2 style="color: #ef4444;">⚠️ Crisis Alert</h2>
        <p>Multiple negative reviews detected in a short time period.</p>
        <p><strong>Immediate action recommended:</strong></p>
        <ol>
          <li>Review all recent feedback</li>
          <li>Identify the root cause</li>
          <li>Prepare a response strategy</li>
          <li>Monitor social media for mentions</li>
        </ol>
        <p><a href="${process.env.FRONTEND_URL}/dashboard/crisis" style="background-color: #ef4444; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Open Crisis Dashboard</a></p>
      `,
      default_alert: `
        <h2>Alert: ${event.data.ruleName}</h2>
        <p>An alert has been triggered at ${event.triggeredAt.toLocaleString()}</p>
        <p>Details: ${JSON.stringify(event.data, null, 2)}</p>
      `,
    };

    return templates[template] || templates.default_alert;
  }

  // Batch check for performance
  async batchCheckAlerts(reviews: Review[], userId: string): Promise<void> {
    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < reviews.length; i += batchSize) {
      const batch = reviews.slice(i, i + batchSize);
      await Promise.all(batch.map(review => this.checkAlerts(review, userId)));
    }
  }
}