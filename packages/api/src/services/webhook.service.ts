import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../database';
import { logger } from '../utils/logger';

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  signature?: string;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
  headers?: Record<string, string>;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class WebhookService {
  private defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  async send(
    url: string,
    payload: WebhookPayload,
    config?: Partial<WebhookConfig>
  ): Promise<void> {
    const webhookConfig: WebhookConfig = {
      url,
      events: [],
      retryPolicy: this.defaultRetryPolicy,
      ...config,
    };

    // Add signature if secret is provided
    if (webhookConfig.secret) {
      payload.signature = this.generateSignature(payload, webhookConfig.secret);
    }

    // Attempt to send webhook with retry logic
    await this.sendWithRetry(webhookConfig, payload);
  }

  private async sendWithRetry(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const { retryPolicy } = config;
    let lastError: Error | null = null;
    let delay = retryPolicy!.initialDelay;

    for (let attempt = 0; attempt <= retryPolicy!.maxRetries; attempt++) {
      try {
        await this.sendWebhook(config, payload);
        
        // Log successful webhook
        await this.logWebhook({
          url: config.url,
          event: payload.event,
          status: 'success',
          attempt: attempt + 1,
          timestamp: new Date(),
        });
        
        return; // Success, exit
      } catch (error: any) {
        lastError = error;
        
        // Log failed attempt
        await this.logWebhook({
          url: config.url,
          event: payload.event,
          status: 'failed',
          attempt: attempt + 1,
          error: error.message,
          timestamp: new Date(),
        });

        if (attempt < retryPolicy!.maxRetries) {
          // Wait before retrying
          await this.wait(delay);
          delay = Math.min(delay * retryPolicy!.backoffMultiplier, retryPolicy!.maxDelay);
        }
      }
    }

    // All retries failed
    logger.error('Webhook delivery failed after all retries', {
      url: config.url,
      event: payload.event,
      error: lastError?.message,
    });

    throw new Error(`Webhook delivery failed: ${lastError?.message}`);
  }

  private async sendWebhook(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ReviewInsightsAI/1.0',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      ...config.headers,
    };

    if (payload.signature) {
      headers['X-Webhook-Signature'] = payload.signature;
    }

    const response = await axios.post(config.url, payload, {
      headers,
      timeout: 30000, // 30 second timeout
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    if (response.status >= 400) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }
  }

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify({
      event: payload.event,
      data: payload.data,
      timestamp: payload.timestamp,
    }));
    return hmac.digest('hex');
  }

  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async logWebhook(log: any): Promise<void> {
    // In production, this would write to a webhook_logs table
    logger.info('Webhook log', log);
  }

  // Verify incoming webhooks (for receiving webhooks)
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Register webhook endpoint
  async registerWebhook(
    userId: string,
    config: WebhookConfig
  ): Promise<string> {
    // In real implementation, store in database
    const webhookId = crypto.randomBytes(16).toString('hex');
    
    // Store webhook configuration
    await prisma.usageRecord.create({
      data: {
        userId,
        action: 'webhook_registered',
        credits: 0,
        metadata: {
          webhookId,
          url: config.url,
          events: config.events,
        },
      },
    });

    return webhookId;
  }

  // Bulk webhook notifications
  async sendBulkWebhooks(
    webhooks: Array<{ url: string; payload: WebhookPayload; config?: Partial<WebhookConfig> }>,
    options?: { parallel?: boolean }
  ): Promise<void> {
    if (options?.parallel) {
      // Send in parallel with concurrency limit
      const concurrencyLimit = 10;
      const chunks = this.chunkArray(webhooks, concurrencyLimit);
      
      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map((webhook) => 
            this.send(webhook.url, webhook.payload, webhook.config)
          )
        );
      }
    } else {
      // Send sequentially
      for (const webhook of webhooks) {
        try {
          await this.send(webhook.url, webhook.payload, webhook.config);
        } catch (error) {
          logger.error('Bulk webhook failed', { url: webhook.url, error });
        }
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Common webhook events
  async notifyReviewCollected(userId: string, review: any): Promise<void> {
    const webhooks = await this.getUserWebhooks(userId, 'review.collected');
    
    const payload: WebhookPayload = {
      event: 'review.collected',
      data: {
        reviewId: review.id,
        rating: review.rating,
        source: review.source,
        sentiment: review.sentimentScore,
        content: review.content.substring(0, 200) + '...',
      },
      timestamp: new Date().toISOString(),
    };

    await this.sendToUserWebhooks(webhooks, payload);
  }

  async notifyReportGenerated(userId: string, report: any): Promise<void> {
    const webhooks = await this.getUserWebhooks(userId, 'report.generated');
    
    const payload: WebhookPayload = {
      event: 'report.generated',
      data: {
        reportId: report.id,
        title: report.title,
        insightsCount: report.insights.length,
        downloadUrl: `${process.env.API_URL}/reports/${report.id}/download`,
      },
      timestamp: new Date().toISOString(),
    };

    await this.sendToUserWebhooks(webhooks, payload);
  }

  async notifySubscriptionChanged(userId: string, subscription: any): Promise<void> {
    const webhooks = await this.getUserWebhooks(userId, 'subscription.changed');
    
    const payload: WebhookPayload = {
      event: 'subscription.changed',
      data: {
        plan: subscription.plan,
        status: subscription.stripeStatus,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      timestamp: new Date().toISOString(),
    };

    await this.sendToUserWebhooks(webhooks, payload);
  }

  private async getUserWebhooks(
    userId: string,
    event: string
  ): Promise<WebhookConfig[]> {
    // In real implementation, fetch from database
    // For now, return empty array
    return [];
  }

  private async sendToUserWebhooks(
    webhooks: WebhookConfig[],
    payload: WebhookPayload
  ): Promise<void> {
    const webhookJobs = webhooks.map((webhook) => ({
      url: webhook.url,
      payload,
      config: webhook,
    }));

    await this.sendBulkWebhooks(webhookJobs, { parallel: true });
  }
}