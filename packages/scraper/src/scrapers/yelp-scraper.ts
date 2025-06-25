import puppeteer from 'puppeteer';
import { ReviewData } from '../dataforseo-client';
import { BaseScraper } from './base-scraper';
import { logger } from '../logger';

export class YelpScraper extends BaseScraper {
  get sourceName(): string {
    return 'Yelp';
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
      const searchUrl = this.buildSearchUrl(businessName, location);
      await this.navigateWithRetry(page, searchUrl);

      // Find and click on the first business result
      const businessLink = await page.$('a[href*="/biz/"]');
      if (!businessLink) {
        logger.warn('No Yelp business found', { businessName });
        return [];
      }

      await businessLink.click();
      await page.waitForNavigation();

      // Wait for reviews to load
      await page.waitForSelector('div[class*="review__"]', { timeout: 10000 });

      // Click "Read more" on all reviews to expand them
      const readMoreButtons = await page.$$('a[class*="read-more"]');
      for (const button of readMoreButtons) {
        try {
          await button.click();
        } catch (e) {
          // Some buttons might not be clickable
        }
      }

      // Extract business info
      const businessInfo = await page.evaluate(() => {
        const nameEl = document.querySelector('h1');
        const ratingEl = document.querySelector('div[class*="five-stars"]');
        const reviewCountEl = document.querySelector('span[class*="reviewCount"]');
        
        return {
          name: nameEl?.textContent?.trim() || '',
          rating: ratingEl?.getAttribute('aria-label') || '',
          reviewCount: reviewCountEl?.textContent?.trim() || '',
        };
      });

      // Load more reviews by scrolling
      await this.scrollToLoadMore(page, 15);

      // Extract reviews
      const reviews = await page.evaluate(() => {
        const reviewElements = document.querySelectorAll('div[class*="review__"]');
        const reviewsData: any[] = [];

        reviewElements.forEach((element) => {
          // Extract rating
          const ratingEl = element.querySelector('div[class*="five-stars"]');
          const ratingText = ratingEl?.getAttribute('aria-label') || '';
          const rating = parseFloat(ratingText.match(/(\d+(\.\d+)?)/)?.[1] || '0');

          // Extract author
          const authorEl = element.querySelector('a[href*="/user_details"]');
          const author = authorEl?.textContent?.trim() || 'Anonymous';

          // Extract date
          const dateEl = element.querySelector('span[class*="css-chan6m"]');
          const dateText = dateEl?.textContent?.trim() || '';

          // Extract content
          const contentEl = element.querySelector('p[class*="comment"]');
          const content = contentEl?.textContent?.trim() || '';

          // Extract helpful votes
          const helpfulEl = element.querySelector('span[class*="useful"]');
          const helpfulText = helpfulEl?.textContent || '';
          const helpful = parseInt(helpfulText.match(/(\d+)/)?.[1] || '0');

          // Check if elite user
          const isElite = element.querySelector('span[class*="elite"]') !== null;

          // Extract photos
          const photos = Array.from(element.querySelectorAll('img[class*="photo-box-img"]'))
            .map(img => img.getAttribute('src'))
            .filter(Boolean);

          reviewsData.push({
            rating,
            author,
            dateText,
            content,
            helpful,
            isElite,
            photos,
          });
        });

        return reviewsData;
      });

      // Convert to standard format
      return reviews.map((review) => ({
        reviewId: this.generateReviewId('yelp'),
        author: review.author,
        rating: review.rating,
        content: this.sanitizeText(review.content),
        date: this.parseYelpDate(review.dateText),
        verified: review.isElite, // Elite users are verified
        helpful: review.helpful,
        source: this.sourceName,
        metadata: {
          platform: 'Yelp',
          businessName: businessInfo.name,
          isEliteUser: review.isElite,
          photos: review.photos,
        },
      }));
    } catch (error) {
      logger.error('Failed to scrape Yelp reviews', { error, businessName });
      throw error;
    } finally {
      await browser.close();
    }
  }

  private buildSearchUrl(businessName: string, location?: string): string {
    const query = location ? `${businessName} ${location}` : businessName;
    return `https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}`;
  }

  private parseYelpDate(dateText: string): Date {
    // Yelp dates are like "10/25/2023" or "2 days ago"
    if (dateText.includes('ago')) {
      return this.parseDate(dateText);
    }

    // Try to parse MM/DD/YYYY format
    const parts = dateText.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    return new Date();
  }

  async scrapeBusinessDetails(businessUrl: string): Promise<any> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      await this.navigateWithRetry(page, businessUrl);

      const details = await page.evaluate(() => {
        const getTextContent = (selector: string) => 
          document.querySelector(selector)?.textContent?.trim() || '';

        return {
          name: getTextContent('h1'),
          rating: document.querySelector('div[class*="five-stars"]')?.getAttribute('aria-label') || '',
          reviewCount: getTextContent('span[class*="reviewCount"]'),
          priceRange: getTextContent('span[class*="priceRange"]'),
          categories: Array.from(document.querySelectorAll('span[class*="css-1fdy0l5"] a'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
          address: getTextContent('address'),
          phone: getTextContent('p[class*="css-1p9ibgf"]'),
          website: document.querySelector('a[class*="css-1um3nx"]')?.getAttribute('href') || '',
          hours: Array.from(document.querySelectorAll('tr[class*="css-29kerx"]'))
            .map(row => ({
              day: row.querySelector('th')?.textContent?.trim() || '',
              hours: row.querySelector('td')?.textContent?.trim() || '',
            })),
          amenities: Array.from(document.querySelectorAll('div[class*="arrange-unit"] span[class*="css-1p9ibgf"]'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
          photos: Array.from(document.querySelectorAll('img[class*="photo-box-img"]'))
            .slice(0, 10)
            .map(img => img.getAttribute('src'))
            .filter(Boolean),
        };
      });

      return details;
    } catch (error) {
      logger.error('Failed to scrape Yelp business details', { error, businessUrl });
      throw error;
    } finally {
      await browser.close();
    }
  }
}