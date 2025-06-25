import { Page } from 'puppeteer';
import { ReviewData } from '../dataforseo-client';
import { logger } from '../logger';
import { retry } from '../retry';

export interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  maxRetries?: number;
  rateLimitMs?: number;
}

export abstract class BaseScraper {
  protected config: Required<ScraperConfig>;
  protected lastRequestTime: number = 0;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      maxRetries: 3,
      rateLimitMs: 1000,
      ...config,
    };
  }

  abstract get sourceName(): string;
  abstract scrapeReviews(businessName: string, location?: string): Promise<ReviewData[]>;

  protected async rateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.rateLimitMs) {
      await new Promise(resolve => 
        setTimeout(resolve, this.config.rateLimitMs - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  protected async navigateWithRetry(page: Page, url: string): Promise<void> {
    await retry(
      async () => {
        await this.rateLimit();
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout,
        });
      },
      this.config.maxRetries,
      {
        shouldRetry: (error) => {
          const message = error.message || '';
          return message.includes('TimeoutError') || 
                 message.includes('net::') ||
                 message.includes('Navigation failed');
        },
      }
    );
  }

  protected async scrollToLoadMore(page: Page, maxScrolls: number = 10): Promise<void> {
    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      
      if (currentHeight === previousHeight) {
        break; // No more content to load
      }

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await page.waitForTimeout(2000); // Wait for content to load
      previousHeight = currentHeight;
      scrollCount++;
    }
  }

  protected sanitizeText(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\n\r]+/g, ' ')
      .trim();
  }

  protected parseDate(dateString: string): Date {
    try {
      // Try various date formats
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }

      // Handle relative dates like "2 days ago"
      const match = dateString.match(/(\d+)\s+(day|week|month|year)s?\s+ago/i);
      if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const now = new Date();

        switch (unit) {
          case 'day':
            now.setDate(now.getDate() - amount);
            break;
          case 'week':
            now.setDate(now.getDate() - (amount * 7));
            break;
          case 'month':
            now.setMonth(now.getMonth() - amount);
            break;
          case 'year':
            now.setFullYear(now.getFullYear() - amount);
            break;
        }
        return now;
      }

      return new Date(); // Fallback to current date
    } catch (error) {
      logger.warn('Failed to parse date', { dateString, error });
      return new Date();
    }
  }

  protected generateReviewId(source: string): string {
    return `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}