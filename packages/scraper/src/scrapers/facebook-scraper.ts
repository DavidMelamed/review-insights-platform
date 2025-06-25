import puppeteer from 'puppeteer';
import { ReviewData } from '../dataforseo-client';
import { BaseScraper } from './base-scraper';
import { logger } from '../logger';

export class FacebookScraper extends BaseScraper {
  get sourceName(): string {
    return 'Facebook';
  }

  async scrapeReviews(businessName: string, location?: string): Promise<ReviewData[]> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      // Search for business page
      const searchUrl = `https://www.facebook.com/search/pages?q=${encodeURIComponent(businessName)}`;
      await this.navigateWithRetry(page, searchUrl);

      // Note: Facebook requires login for full access
      // This is a simplified version that works with public data
      
      // Click on first business result
      const businessLink = await page.$('a[role="link"][href*="/pages/"]');
      if (!businessLink) {
        logger.warn('No Facebook business page found', { businessName });
        return [];
      }

      await businessLink.click();
      await page.waitForNavigation();

      // Navigate to reviews tab
      const reviewsTab = await page.$('a[href*="reviews"]');
      if (reviewsTab) {
        await reviewsTab.click();
        await page.waitForTimeout(3000);
      }

      // Wait for reviews to load
      await page.waitForSelector('div[role="article"]', { timeout: 10000 }).catch(() => null);

      // Scroll to load more reviews
      await this.scrollToLoadMore(page, 5);

      // Extract reviews
      const reviews = await page.evaluate(() => {
        const reviewElements = document.querySelectorAll('div[role="article"]');
        const reviewsData: any[] = [];

        reviewElements.forEach((element) => {
          // Extract rating from stars
          const stars = element.querySelectorAll('[aria-label*="star"]');
          const rating = stars.length;

          // Extract author
          const authorEl = element.querySelector('strong');
          const author = authorEl?.textContent?.trim() || 'Anonymous';

          // Extract date
          const dateEl = element.querySelector('abbr[data-utime]');
          const timestamp = dateEl?.getAttribute('data-utime');
          const dateValue = timestamp ? new Date(parseInt(timestamp) * 1000) : new Date();

          // Extract content
          const contentEl = element.querySelector('div[data-ad-preview="message"]');
          const content = contentEl?.textContent?.trim() || '';

          // Extract reactions
          const reactionsEl = element.querySelector('[aria-label*="reaction"]');
          const reactionsText = reactionsEl?.getAttribute('aria-label') || '';
          const helpful = parseInt(reactionsText.match(/(\d+)/)?.[1] || '0');

          // Check if recommendation
          const hasRecommendation = element.textContent?.includes('recommends') || false;

          reviewsData.push({
            rating,
            author,
            dateValue,
            content,
            helpful,
            hasRecommendation,
          });
        });

        return reviewsData;
      });

      // Convert to standard format
      return reviews.map((review) => ({
        reviewId: this.generateReviewId('facebook'),
        author: review.author,
        rating: review.rating,
        title: review.hasRecommendation ? 'Recommends this business' : '',
        content: this.sanitizeText(review.content),
        date: review.dateValue,
        verified: false, // Facebook doesn't show verification
        helpful: review.helpful,
        source: this.sourceName,
        metadata: {
          platform: 'Facebook',
          hasRecommendation: review.hasRecommendation,
          reactions: review.helpful,
        },
      }));
    } catch (error) {
      logger.error('Failed to scrape Facebook reviews', { error, businessName });
      throw error;
    } finally {
      await browser.close();
    }
  }

  async getPageInfo(pageUrl: string): Promise<any> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      await this.navigateWithRetry(page, pageUrl);

      const pageInfo = await page.evaluate(() => {
        const getTextContent = (selector: string) => 
          document.querySelector(selector)?.textContent?.trim() || '';

        // Extract page stats
        const statsText = document.querySelector('[role="contentinfo"]')?.textContent || '';
        const likesMatch = statsText.match(/(\d+[,\d]*)\s*likes/i);
        const followersMatch = statsText.match(/(\d+[,\d]*)\s*followers/i);

        return {
          name: getTextContent('h1'),
          category: getTextContent('div[role="contentinfo"] a'),
          likes: likesMatch ? parseInt(likesMatch[1].replace(/,/g, '')) : 0,
          followers: followersMatch ? parseInt(followersMatch[1].replace(/,/g, '')) : 0,
          rating: parseFloat(getTextContent('[aria-label*="star rating"]') || '0'),
          
          // About section
          about: getTextContent('div[data-pagelet="ProfileTilesFeed_0"] span'),
          
          // Contact info
          website: document.querySelector('a[href*="l.facebook.com/l.php"]')?.getAttribute('href') || '',
          phone: getTextContent('div[role="contentinfo"] span[dir="ltr"]'),
          
          // Location
          address: getTextContent('div[role="contentinfo"] span[class*="x1lliihq"]'),
          
          // Hours
          isOpen: document.querySelector('span[class*="x16tdsg8"]')?.textContent?.includes('Open') || false,
        };
      });

      return pageInfo;
    } catch (error) {
      logger.error('Failed to get Facebook page info', { error, pageUrl });
      throw error;
    } finally {
      await browser.close();
    }
  }

  private async scrollToLoadMore(page: puppeteer.Page, maxScrolls: number = 5): Promise<void> {
    for (let i = 0; i < maxScrolls; i++) {
      const previousHeight = await page.evaluate(() => document.body.scrollHeight);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(2000);
      
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      
      if (newHeight === previousHeight) {
        break; // No more content to load
      }
    }
  }
}