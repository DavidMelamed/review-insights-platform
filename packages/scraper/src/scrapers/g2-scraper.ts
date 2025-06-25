import puppeteer from 'puppeteer';
import { ReviewData } from '../dataforseo-client';
import { BaseScraper } from './base-scraper';
import { logger } from '../logger';

export class G2Scraper extends BaseScraper {
  get sourceName(): string {
    return 'G2';
  }

  async scrapeReviews(businessName: string, location?: string): Promise<ReviewData[]> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      // Search for software
      const searchUrl = `https://www.g2.com/search?query=${encodeURIComponent(businessName)}`;
      await this.navigateWithRetry(page, searchUrl);

      // Click on first product result
      const productLink = await page.$('div[class*="product-card"] a[href*="/products/"]');
      if (!productLink) {
        logger.warn('No G2 product found', { businessName });
        return [];
      }

      await productLink.click();
      await page.waitForNavigation();

      // Navigate to reviews section
      const reviewsLink = await page.$('a[href*="#reviews"]');
      if (reviewsLink) {
        await reviewsLink.click();
        await page.waitForTimeout(2000);
      }

      // Wait for reviews to load
      await page.waitForSelector('div[itemprop="review"]', { timeout: 10000 });

      // Extract product info
      const productInfo = await page.evaluate(() => {
        return {
          name: document.querySelector('h1[itemprop="name"]')?.textContent?.trim() || '',
          rating: document.querySelector('span[class*="fw-semibold"]')?.textContent?.trim() || '',
          reviewCount: document.querySelector('span[class*="fw-normal"]')?.textContent?.trim() || '',
        };
      });

      // Load more reviews
      let loadMoreAttempts = 0;
      while (loadMoreAttempts < 5) {
        const loadMoreButton = await page.$('button[data-test="load-more-button"]');
        if (!loadMoreButton) break;
        
        await loadMoreButton.click();
        await page.waitForTimeout(2000);
        loadMoreAttempts++;
      }

      // Extract reviews
      const reviews = await page.evaluate(() => {
        const reviewElements = document.querySelectorAll('div[itemprop="review"]');
        const reviewsData: any[] = [];

        reviewElements.forEach((element) => {
          // Extract rating
          const stars = element.querySelectorAll('svg[class*="star--filled"]');
          const rating = stars.length;

          // Extract author info
          const authorEl = element.querySelector('div[class*="mt-4th"] span');
          const author = authorEl?.textContent?.trim() || 'Anonymous';

          // Extract author details
          const roleEl = element.querySelector('div[class*="mt-4th"] div[class*="inline-block"]');
          const roleText = roleEl?.textContent?.trim() || '';
          const [role, company] = roleText.split(' at ').map(s => s.trim());

          // Extract date
          const dateEl = element.querySelector('time');
          const dateValue = dateEl?.getAttribute('datetime') || '';

          // Extract title
          const titleEl = element.querySelector('h3 a');
          const title = titleEl?.textContent?.trim() || '';

          // Extract content - pros and cons
          const prosEl = element.querySelector('div[data-test="pros"]');
          const consEl = element.querySelector('div[data-test="cons"]');
          const pros = prosEl?.textContent?.replace('What do you like best?', '').trim() || '';
          const cons = consEl?.textContent?.replace('What do you dislike?', '').trim() || '';

          // Extract verified status
          const verifiedEl = element.querySelector('div[class*="verified"]');
          const verified = verifiedEl !== null;

          // Extract helpful votes
          const helpfulEl = element.querySelector('span[class*="helpful-count"]');
          const helpful = parseInt(helpfulEl?.textContent?.match(/(\d+)/)?.[1] || '0');

          // Extract tags
          const tags = Array.from(element.querySelectorAll('span[class*="x-ui-tag"]'))
            .map(tag => tag.textContent?.trim())
            .filter(Boolean);

          reviewsData.push({
            rating,
            author,
            role,
            company,
            dateValue,
            title,
            pros,
            cons,
            verified,
            helpful,
            tags,
          });
        });

        return reviewsData;
      });

      // Convert to standard format
      return reviews.map((review) => ({
        reviewId: this.generateReviewId('g2'),
        author: review.author,
        rating: review.rating,
        title: review.title,
        content: this.formatG2Content(review.pros, review.cons),
        date: new Date(review.dateValue),
        verified: review.verified,
        helpful: review.helpful,
        source: this.sourceName,
        metadata: {
          platform: 'G2',
          businessName: productInfo.name,
          authorRole: review.role,
          authorCompany: review.company,
          pros: review.pros,
          cons: review.cons,
          tags: review.tags,
          isVerifiedUser: review.verified,
        },
      }));
    } catch (error) {
      logger.error('Failed to scrape G2 reviews', { error, businessName });
      throw error;
    } finally {
      await browser.close();
    }
  }

  private formatG2Content(pros: string, cons: string): string {
    let content = '';
    
    if (pros) {
      content += `Pros: ${pros}\n\n`;
    }
    
    if (cons) {
      content += `Cons: ${cons}`;
    }
    
    return content.trim();
  }

  async getProductDetails(productUrl: string): Promise<any> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      await this.navigateWithRetry(page, productUrl);

      const details = await page.evaluate(() => {
        const getTextContent = (selector: string) => 
          document.querySelector(selector)?.textContent?.trim() || '';

        return {
          name: getTextContent('h1[itemprop="name"]'),
          vendor: getTextContent('a[data-test="product-vendor-name"]'),
          rating: parseFloat(getTextContent('span[class*="fw-semibold"]') || '0'),
          reviewCount: getTextContent('span[class*="fw-normal"]'),
          description: getTextContent('div[itemprop="description"]'),
          
          // Categories
          categories: Array.from(document.querySelectorAll('a[class*="categories__link"]'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
          
          // Pricing
          pricing: getTextContent('div[data-test="pricing-item"]'),
          
          // Features
          features: Array.from(document.querySelectorAll('li[class*="features__feature"]'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
          
          // Ratings breakdown
          ratingsBreakdown: {
            usability: parseFloat(getTextContent('div[data-test="usability"] span') || '0'),
            support: parseFloat(getTextContent('div[data-test="support"] span') || '0'),
            features: parseFloat(getTextContent('div[data-test="features"] span') || '0'),
            value: parseFloat(getTextContent('div[data-test="value"] span') || '0'),
          },
          
          // Comparisons
          comparedTo: Array.from(document.querySelectorAll('a[class*="compare-cell__product"]'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
        };
      });

      return details;
    } catch (error) {
      logger.error('Failed to get G2 product details', { error, productUrl });
      throw error;
    } finally {
      await browser.close();
    }
  }
}