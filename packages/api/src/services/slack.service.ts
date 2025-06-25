import axios from 'axios';
import { logger } from '../utils/logger';

export interface SlackMessage {
  channel: string;
  text: string;
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
  thread_ts?: string; // For threading
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackAttachment {
  color?: 'good' | 'warning' | 'danger' | string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  timestamp?: string;
  actions?: SlackAction[];
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'image' | 'actions' | 'context' | 'header';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
  };
  elements?: any[];
  accessory?: any;
}

export interface SlackAction {
  type: 'button';
  text: string;
  url?: string;
  value?: string;
  style?: 'primary' | 'danger';
}

export class SlackService {
  private webhookUrl?: string;
  private botToken?: string;
  private apiUrl = 'https://slack.com/api';

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.botToken = process.env.SLACK_BOT_TOKEN;
  }

  // Send message via webhook (simpler, no bot needed)
  async sendMessage(message: SlackMessage): Promise<void> {
    if (!this.webhookUrl && !this.botToken) {
      logger.warn('Slack not configured, skipping message');
      return;
    }

    try {
      if (this.botToken) {
        await this.sendViaAPI(message);
      } else if (this.webhookUrl) {
        await this.sendViaWebhook(message);
      }
    } catch (error) {
      logger.error('Failed to send Slack message', error);
      throw error;
    }
  }

  private async sendViaWebhook(message: SlackMessage): Promise<void> {
    await axios.post(this.webhookUrl!, {
      channel: message.channel,
      text: message.text,
      attachments: message.attachments,
      blocks: message.blocks,
    });
  }

  private async sendViaAPI(message: SlackMessage): Promise<void> {
    await axios.post(
      `${this.apiUrl}/chat.postMessage`,
      {
        channel: message.channel,
        text: message.text,
        attachments: message.attachments,
        blocks: message.blocks,
        thread_ts: message.thread_ts,
        unfurl_links: message.unfurl_links,
        unfurl_media: message.unfurl_media,
      },
      {
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Pre-built message templates
  async sendReviewAlert(review: any, channel: string = '#reviews'): Promise<void> {
    const sentiment = review.sentimentScore > 0 ? 'positive' : 
                     review.sentimentScore < 0 ? 'negative' : 'neutral';
    
    const color = review.rating >= 4 ? 'good' : 
                  review.rating <= 2 ? 'danger' : 'warning';

    await this.sendMessage({
      channel,
      text: `New ${review.rating}⭐ review from ${review.source}`,
      attachments: [
        {
          color,
          title: `${review.rating}⭐ Review from ${review.author}`,
          text: review.content.substring(0, 300) + '...',
          fields: [
            {
              title: 'Source',
              value: review.source,
              short: true,
            },
            {
              title: 'Sentiment',
              value: sentiment,
              short: true,
            },
            {
              title: 'Date',
              value: new Date(review.date).toLocaleDateString(),
              short: true,
            },
          ],
          actions: [
            {
              type: 'button',
              text: 'View Review',
              url: `${process.env.FRONTEND_URL}/dashboard/reviews/${review.id}`,
            },
            {
              type: 'button',
              text: 'Respond',
              url: `${process.env.FRONTEND_URL}/dashboard/reviews/${review.id}/respond`,
              style: 'primary',
            },
          ],
        },
      ],
    });
  }

  async sendInsightSummary(insights: any[], channel: string = '#insights'): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Weekly Insights Summary',
        },
      },
      {
        type: 'divider',
      },
    ];

    // Add top insights
    insights.slice(0, 5).forEach((insight) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${insight.title}*\n${insight.description}`,
        },
      });
    });

    // Add action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Full Report',
          },
          url: `${process.env.FRONTEND_URL}/dashboard/reports/latest`,
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Download PDF',
          },
          url: `${process.env.API_URL}/reports/latest/download`,
        },
      ],
    });

    await this.sendMessage({
      channel,
      text: 'Weekly insights summary is ready',
      blocks,
    });
  }

  async sendCompetitorAlert(
    competitorMention: any,
    channel: string = '#competitive-intel'
  ): Promise<void> {
    await this.sendMessage({
      channel,
      text: `🔍 Competitor "${competitorMention.competitor}" mentioned in review`,
      attachments: [
        {
          color: 'warning',
          title: 'Competitor Mention Detected',
          fields: [
            {
              title: 'Competitor',
              value: competitorMention.competitor,
              short: true,
            },
            {
              title: 'Context',
              value: competitorMention.sentiment === 'positive' ? 
                     '✅ Positive comparison' : '❌ Negative comparison',
              short: true,
            },
            {
              title: 'Review Excerpt',
              value: `"...${competitorMention.excerpt}..."`,
              short: false,
            },
          ],
          footer: 'Competitive Intelligence',
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  async sendCrisisAlert(
    crisisData: any,
    channel: string = '#crisis-management'
  ): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 CRISIS ALERT 🚨',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Severity: HIGH*\n${crisisData.description}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Metrics:*',
        },
        fields: [
          {
            type: 'mrkdwn',
            text: `*Negative Reviews (1h):*\n${crisisData.negativeCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Avg Rating (1h):*\n${crisisData.averageRating}⭐`,
          },
          {
            type: 'mrkdwn',
            text: `*Sentiment Score:*\n${crisisData.sentimentScore}`,
          },
          {
            type: 'mrkdwn',
            text: `*Volume Increase:*\n${crisisData.volumeIncrease}%`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Recommended Actions:*\n' +
                '1. Review all recent negative feedback\n' +
                '2. Identify common complaints\n' +
                '3. Prepare public response\n' +
                '4. Brief executive team\n' +
                '5. Monitor social media',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Open Crisis Dashboard',
            },
            url: `${process.env.FRONTEND_URL}/dashboard/crisis`,
            style: 'danger',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View All Reviews',
            },
            url: `${process.env.FRONTEND_URL}/dashboard/reviews?filter=negative&timeframe=1h`,
          },
        ],
      },
    ];

    await this.sendMessage({
      channel,
      text: `<!channel> Crisis Alert: ${crisisData.description}`,
      blocks,
    });
  }

  // Thread management for conversations
  async replyToThread(
    channel: string,
    threadTimestamp: string,
    message: string
  ): Promise<void> {
    await this.sendMessage({
      channel,
      text: message,
      thread_ts: threadTimestamp,
    });
  }

  // Interactive message handling (for button clicks)
  async handleInteraction(payload: any): Promise<void> {
    // This would handle button clicks and other interactions
    // Implementation depends on your Slack app setup
    logger.info('Slack interaction received', payload);
  }

  // Upload files (like reports)
  async uploadFile(
    channels: string[],
    file: Buffer,
    filename: string,
    title?: string,
    comment?: string
  ): Promise<void> {
    if (!this.botToken) {
      logger.warn('Slack bot token not configured, cannot upload file');
      return;
    }

    const formData = new FormData();
    formData.append('token', this.botToken);
    formData.append('channels', channels.join(','));
    formData.append('file', new Blob([file]), filename);
    formData.append('filename', filename);
    if (title) formData.append('title', title);
    if (comment) formData.append('initial_comment', comment);

    await axios.post(`${this.apiUrl}/files.upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}