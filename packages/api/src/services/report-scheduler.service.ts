import { CronJob } from 'cron';
import { prisma } from '../database';
import { reportGenerationQueue } from '../server';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';
import { WebhookService } from './webhook.service';
import { SlackService } from './slack.service';

export interface ReportSchedule {
  id: string;
  userId: string;
  name: string;
  schedule: string; // Cron expression
  config: ReportScheduleConfig;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  timezone: string;
}

export interface ReportScheduleConfig {
  collectionId?: string; // Specific collection or latest
  reportType: 'summary' | 'detailed' | 'competitive' | 'custom';
  timeframe: 'daily' | 'weekly' | 'monthly' | 'custom';
  customTimeframeDays?: number;
  brandConfig: any;
  distribution: DistributionConfig;
  filters?: ReportFilters;
  includePrompts?: boolean;
}

export interface DistributionConfig {
  email: string[];
  slack?: string[];
  webhook?: string[];
  download?: boolean;
}

export interface ReportFilters {
  sources?: string[];
  minRating?: number;
  maxRating?: number;
  sentimentThreshold?: number;
  includeCompetitors?: boolean;
}

export class ReportSchedulerService {
  private jobs: Map<string, CronJob> = new Map();
  private webhookService = new WebhookService();
  private slackService = new SlackService();

  // Common schedule templates
  private scheduleTemplates = {
    daily_morning: '0 9 * * *', // 9 AM daily
    weekly_monday: '0 9 * * 1', // 9 AM every Monday
    monthly_first: '0 9 1 * *', // 9 AM first day of month
    end_of_day: '0 18 * * *', // 6 PM daily
    end_of_week: '0 18 * * 5', // 6 PM Friday
  };

  async initialize(): Promise<void> {
    // Load all active schedules from database
    const schedules = await this.getActiveSchedules();
    
    for (const schedule of schedules) {
      this.startSchedule(schedule);
    }

    logger.info(`Initialized ${schedules.length} report schedules`);
  }

  async createSchedule(
    userId: string,
    schedule: Omit<ReportSchedule, 'id' | 'lastRun' | 'nextRun'>
  ): Promise<ReportSchedule> {
    // Validate cron expression
    try {
      new CronJob(schedule.schedule, () => {});
    } catch (error) {
      throw new Error('Invalid cron expression');
    }

    // Check user's plan allows scheduled reports
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) throw new Error('User not found');

    const allowedSchedules = this.getAllowedSchedules(user.subscription?.plan || 'FREE');
    const existingSchedules = await this.getUserSchedules(userId);

    if (existingSchedules.length >= allowedSchedules) {
      throw new Error(`Your plan allows only ${allowedSchedules} scheduled reports`);
    }

    // Create schedule in database
    const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newSchedule: ReportSchedule = {
      id: scheduleId,
      userId,
      ...schedule,
      nextRun: this.calculateNextRun(schedule.schedule, schedule.timezone),
    };

    // Store in database (simplified for demo)
    await prisma.usageRecord.create({
      data: {
        userId,
        action: 'schedule_created',
        credits: 0,
        metadata: newSchedule,
      },
    });

    // Start the schedule if enabled
    if (newSchedule.enabled) {
      this.startSchedule(newSchedule);
    }

    return newSchedule;
  }

  private startSchedule(schedule: ReportSchedule): void {
    if (this.jobs.has(schedule.id)) {
      this.jobs.get(schedule.id)!.stop();
    }

    const job = new CronJob(
      schedule.schedule,
      async () => {
        await this.executeScheduledReport(schedule);
      },
      null,
      true,
      schedule.timezone
    );

    this.jobs.set(schedule.id, job);
    logger.info(`Started schedule: ${schedule.id}`);
  }

  private async executeScheduledReport(schedule: ReportSchedule): Promise<void> {
    try {
      logger.info(`Executing scheduled report: ${schedule.name}`);

      // Get the collection to report on
      const collectionId = await this.getCollectionForReport(
        schedule.userId,
        schedule.config
      );

      if (!collectionId) {
        logger.warn(`No collection found for scheduled report: ${schedule.id}`);
        return;
      }

      // Queue report generation
      const job = await reportGenerationQueue.add('generate-report', {
        userId: schedule.userId,
        collectionId,
        config: {
          type: schedule.config.reportType,
          brandConfig: schedule.config.brandConfig,
          filters: schedule.config.filters,
          includePrompts: schedule.config.includePrompts,
        },
        distribution: schedule.config.distribution,
        scheduleId: schedule.id,
      });

      // Update last run time
      await this.updateLastRun(schedule.id);

      logger.info(`Queued scheduled report: ${schedule.id}, job: ${job.id}`);
    } catch (error) {
      logger.error(`Failed to execute scheduled report: ${schedule.id}`, error);
      
      // Notify user of failure
      await this.notifyScheduleFailure(schedule, error as Error);
    }
  }

  private async getCollectionForReport(
    userId: string,
    config: ReportScheduleConfig
  ): Promise<string | null> {
    if (config.collectionId) {
      return config.collectionId;
    }

    // Get latest collection based on timeframe
    const startDate = this.getTimeframeStartDate(config.timeframe, config.customTimeframeDays);

    const collection = await prisma.reviewCollection.findFirst({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    return collection?.id || null;
  }

  private getTimeframeStartDate(
    timeframe: string,
    customDays?: number
  ): Date {
    const now = new Date();
    
    switch (timeframe) {
      case 'daily':
        return new Date(now.setDate(now.getDate() - 1));
      case 'weekly':
        return new Date(now.setDate(now.getDate() - 7));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'custom':
        return new Date(now.setDate(now.getDate() - (customDays || 30)));
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }

  async distributeReport(
    reportId: string,
    distribution: DistributionConfig
  ): Promise<void> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { user: true },
    });

    if (!report) {
      throw new Error('Report not found');
    }

    // Email distribution
    if (distribution.email.length > 0) {
      await this.emailReport(report, distribution.email);
    }

    // Slack distribution
    if (distribution.slack && distribution.slack.length > 0) {
      await this.slackReport(report, distribution.slack);
    }

    // Webhook distribution
    if (distribution.webhook && distribution.webhook.length > 0) {
      await this.webhookReport(report, distribution.webhook);
    }
  }

  private async emailReport(report: any, recipients: string[]): Promise<void> {
    const downloadUrl = `${process.env.API_URL}/reports/${report.id}/download`;
    
    for (const email of recipients) {
      await sendEmail({
        to: email,
        subject: `📊 ${report.title} - Review Insights Report`,
        html: `
          <h2>${report.title}</h2>
          <p>Your scheduled review analysis report is ready!</p>
          
          <h3>Key Insights:</h3>
          <ul>
            ${report.insights.slice(0, 3).map((insight: any) => 
              `<li><strong>${insight.title}:</strong> ${insight.description}</li>`
            ).join('')}
          </ul>
          
          <p>
            <a href="${downloadUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Download Full Report
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
            This report was automatically generated and sent to you based on your schedule preferences.
            <a href="${process.env.FRONTEND_URL}/dashboard/schedules">Manage your schedules</a>
          </p>
        `,
      });
    }
  }

  private async slackReport(report: any, channels: string[]): Promise<void> {
    for (const channel of channels) {
      await this.slackService.sendMessage({
        channel,
        text: `📊 ${report.title} is ready!`,
        attachments: [
          {
            color: 'good',
            title: report.title,
            title_link: `${process.env.FRONTEND_URL}/dashboard/reports/${report.id}`,
            fields: report.insights.slice(0, 3).map((insight: any) => ({
              title: insight.title,
              value: insight.description,
              short: false,
            })),
            actions: [
              {
                type: 'button',
                text: 'View Report',
                url: `${process.env.FRONTEND_URL}/dashboard/reports/${report.id}`,
                style: 'primary',
              },
              {
                type: 'button',
                text: 'Download PDF',
                url: `${process.env.API_URL}/reports/${report.id}/download`,
              },
            ],
            footer: 'Review Insights AI',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }
  }

  private async webhookReport(report: any, webhookUrls: string[]): Promise<void> {
    const payload = {
      event: 'report.scheduled',
      data: {
        reportId: report.id,
        title: report.title,
        insights: report.insights,
        downloadUrl: `${process.env.API_URL}/reports/${report.id}/download`,
        viewUrl: `${process.env.FRONTEND_URL}/dashboard/reports/${report.id}`,
      },
      timestamp: new Date().toISOString(),
    };

    for (const url of webhookUrls) {
      await this.webhookService.send(url, payload);
    }
  }

  private async notifyScheduleFailure(schedule: ReportSchedule, error: Error): Promise<void> {
    await sendEmail({
      to: await this.getUserEmail(schedule.userId),
      subject: `⚠️ Scheduled Report Failed: ${schedule.name}`,
      html: `
        <h2>Scheduled Report Failed</h2>
        <p>Your scheduled report "${schedule.name}" failed to generate.</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <p>Please check your configuration and try again.</p>
        <p>
          <a href="${process.env.FRONTEND_URL}/dashboard/schedules/${schedule.id}">
            View Schedule Settings
          </a>
        </p>
      `,
    });
  }

  private getAllowedSchedules(plan: string): number {
    const limits: Record<string, number> = {
      FREE: 0,
      STARTER: 2,
      PROFESSIONAL: 10,
      ENTERPRISE: -1, // Unlimited
    };

    return limits[plan] || 0;
  }

  private calculateNextRun(cronExpression: string, timezone: string): Date {
    const job = new CronJob(cronExpression, () => {}, null, false, timezone);
    return job.nextDates(1)[0].toDate();
  }

  private async updateLastRun(scheduleId: string): Promise<void> {
    // Update in database
    // In real implementation, update the schedule record
    logger.info(`Updated last run for schedule: ${scheduleId}`);
  }

  private async getActiveSchedules(): Promise<ReportSchedule[]> {
    // In real implementation, fetch from database
    return [];
  }

  private async getUserSchedules(userId: string): Promise<ReportSchedule[]> {
    // In real implementation, fetch from database
    return [];
  }

  private async getUserEmail(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user?.email || '';
  }

  // Management methods
  async pauseSchedule(scheduleId: string): Promise<void> {
    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      this.jobs.delete(scheduleId);
    }
  }

  async resumeSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.getSchedule(scheduleId);
    if (schedule && schedule.enabled) {
      this.startSchedule(schedule);
    }
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    this.pauseSchedule(scheduleId);
    // Delete from database
  }

  private async getSchedule(scheduleId: string): Promise<ReportSchedule | null> {
    // In real implementation, fetch from database
    return null;
  }

  // Cleanup on shutdown
  shutdown(): void {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    logger.info('Report scheduler shut down');
  }
}