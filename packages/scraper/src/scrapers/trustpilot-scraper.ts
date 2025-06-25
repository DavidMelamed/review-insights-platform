import puppeteer from 'puppeteer';
import { ReviewData } from '../dataforseo-client';
import { BaseScraper } from './base-scraper';
import { logger } from '../logger';

export class TrustpilotScraper extends BaseScraper {
  get sourceName(): string {
    return 'Trustpilot';
  }

  async scrapeReviews(businessName: string, location?: string): Promise<ReviewData[]> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      // Search for business
      const searchUrl = `https://www.trustpilot.com/search?query=${encodeURIComponent(businessName)}`;
      await this.navigateWithRetry(page, searchUrl);

      // Click on first business result
      const businessLink = await page.$('a[class*="businessUnitResult"]');
      if (!businessLink) {
        logger.warn('No Trustpilot business found', { businessName });
        return [];
      }

      const businessUrl = await page.evaluate(el => el.getAttribute('href'), businessLink);
      if (!businessUrl) return [];

      // Navigate to business page
      await this.navigateWithRetry(page, `https://www.trustpilot.com${businessUrl}`);

      // Wait for reviews
      await page.waitForSelector('article[class*="review"]', { timeout: 10000 });

      // Get total pages
      const totalPages = await page.evaluate(() => {
        const pagination = document.querySelector('nav[class*="pagination"]');
        const lastPageLink = pagination?.querySelector('a:last-child');
        const pageText = lastPageLink?.getAttribute('aria-label') || '';
        const match = pageText.match(/Page (\d+)/);
        return match ? parseInt(match[1]) : 1;
      });

      const allReviews: ReviewData[] = [];
      const maxPages = Math.min(totalPages, 10); // Limit to 10 pages

      // Scrape each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        if (pageNum > 1) {
          const pageUrl = `${businessUrl}?page=${pageNum}`;
          await this.navigateWithRetry(page, `https://www.trustpilot.com${pageUrl}`);
          await page.waitForSelector('article[class*="review"]', { timeout: 10000 });
        }

        const pageReviews = await this.extractReviewsFromPage(page);
        allReviews.push(...pageReviews);

        // Rate limiting between pages
        await this.rateLimit();
      }

      return allReviews;
    } catch (error) {
      logger.error('Failed to scrape Trustpilot reviews', { error, businessName });
      throw error;
    } finally {
      await browser.close();
    }
  }

  private async extractReviewsFromPage(page: puppeteer.Page): Promise<ReviewData[]> {
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('article[class*="review"]');
      const reviewsData: any[] = [];

      reviewElements.forEach((element) => {
        // Extract rating
        const ratingEl = element.querySelector('div[data-rating]');
        const rating = parseInt(ratingEl?.getAttribute('data-rating') || '0');

        // Extract author
        const authorEl = element.querySelector('span[data-consumer-name-typography]');
        const author = authorEl?.textContent?.trim() || 'Anonymous';

        // Extract date
        const dateEl = element.querySelector('time');
        const dateValue = dateEl?.getAttribute('datetime') || '';

        // Extract title
        const titleEl = element.querySelector('h2[data-service-review-title-typography]');
        const title = titleEl?.textContent?.trim() || '';

        // Extract content
        const contentEl = element.querySelector('p[data-service-review-text-typography]');
        const content = contentEl?.textContent?.trim() || '';

        // Check if verified
        const verifiedEl = element.querySelector('div[data-verified-order]');
        const verified = verifiedEl !== null;

        // Extract location
        const locationEl = element.querySelector('div[data-consumer-country-typography] span');
        const reviewerLocation = locationEl?.textContent?.trim() || '';

        // Extract helpful count
        const helpfulEl = element.querySelector('button[data-review-helpful-button] span');
        const helpfulText = helpfulEl?.textContent || '';
        const helpful = parseInt(helpfulText.match(/(\d+)/)?.[1] || '0');

        // Company reply
        const replyEl = element.querySelector('div[class*="replyInfo"]');
        const hasReply = replyEl !== null;

        reviewsData.push({
          rating,
          author,
          dateValue,
          title,
          content,
          verified,
          reviewerLocation,
          helpful,
          hasReply,
        });
      });

      return reviewsData;
    });

    return reviews.map((review) => ({
      reviewId: this.generateReviewId('trustpilot'),
      author: review.author,
      rating: review.rating,
      title: review.title,
      content: this.sanitizeText(review.content),
      date: new Date(review.dateValue),
      verified: review.verified,
      helpful: review.helpful,
      source: this.sourceName,
      metadata: {
        platform: 'Trustpilot',
        reviewerLocation: review.reviewerLocation,
        hasCompanyReply: review.hasReply,
        isVerifiedPurchase: review.verified,
      },
    }));
  }

  async getBusinessInfo(businessUrl: string): Promise<any> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      await this.navigateWithRetry(page, businessUrl);

      const businessInfo = await page.evaluate(() => {
        const getTextContent = (selector: string) => 
          document.querySelector(selector)?.textContent?.trim() || '';

        return {
          name: getTextContent('h1 span'),
          rating: document.querySelector('p[data-rating-typography]')?.textContent?.trim() || '',
          reviewCount: getTextContent('p[class*="typography_body"]'),
          trustScore: getTextContent('p[data-rating-typography]'),
          categories: Array.from(document.querySelectorAll('a[class*="category"]'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
          website: document.querySelector('a[class*="websiteUrl"]')?.getAttribute('href') || '',
          description: getTextContent('div[class*="businessUnitDescription"]'),
          verifiedCompany: document.querySelector('div[class*="verified-company"]') !== null,
          claimedProfile: document.querySelector('div[class*="claimed"]') !== null,
        };
      });

      return businessInfo;
    } catch (error) {
      logger.error('Failed to get Trustpilot business info', { error, businessUrl });
      throw error;
    } finally {
      await browser.close();
    }
  }
}