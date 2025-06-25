import puppeteer from 'puppeteer';
import { ReviewData } from '../dataforseo-client';
import { BaseScraper } from './base-scraper';
import { logger } from '../logger';

export class GoogleReviewsScraper extends BaseScraper {
  get sourceName(): string {
    return 'Google Reviews';
  }

  async scrapeReviews(businessName: string, location?: string): Promise<ReviewData[]> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      // Search for the business
      const searchQuery = location 
        ? `${businessName} ${location} google reviews`
        : `${businessName} google reviews`;
      
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      await this.navigateWithRetry(page, searchUrl);

      // Click on the reviews section
      const reviewsButton = await page.$('a[data-async-trigger="reviewDialog"]');
      if (!reviewsButton) {
        logger.warn('No reviews button found for business', { businessName });
        return [];
      }

      await reviewsButton.click();
      await page.waitForSelector('div[data-review-id]', { timeout: 10000 });

      // Scroll to load all reviews
      await this.scrollToLoadMore(page, 20);

      // Extract reviews
      const reviews = await page.evaluate(() => {
        const reviewElements = document.querySelectorAll('div[data-review-id]');
        const reviewsData: any[] = [];

        reviewElements.forEach((element) => {
          const ratingElement = element.querySelector('span[role="img"]');
          const ratingText = ratingElement?.getAttribute('aria-label') || '';
          const rating = parseInt(ratingText.match(/(\d+)/)?.[1] || '0');

          const authorElement = element.querySelector('div[class*="fontTitleSmall"]');
          const contentElement = element.querySelector('span[data-expandable-section]');
          const dateElement = element.querySelector('span[class*="rsqaWe"]');

          reviewsData.push({
            author: authorElement?.textContent || 'Anonymous',
            rating: rating,
            content: contentElement?.textContent || '',
            dateText: dateElement?.textContent || '',
          });
        });

        return reviewsData;
      });

      return reviews.map((review) => ({
        reviewId: this.generateReviewId('google'),
        author: this.sanitizeText(review.author),
        rating: review.rating,
        content: this.sanitizeText(review.content),
        date: this.parseDate(review.dateText),
        verified: true, // Google reviews are verified by default
        source: this.sourceName,
        metadata: {
          platform: 'Google',
          businessName: businessName,
        },
      }));
    } catch (error) {
      logger.error('Failed to scrape Google reviews', { error, businessName });
      throw error;
    } finally {
      await browser.close();
    }
  }
}