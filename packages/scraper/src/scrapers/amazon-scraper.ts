import puppeteer from 'puppeteer';
import { ReviewData } from '../dataforseo-client';
import { BaseScraper } from './base-scraper';
import { logger } from '../logger';

export class AmazonScraper extends BaseScraper {
  get sourceName(): string {
    return 'Amazon';
  }

  async scrapeReviews(productIdentifier: string, location?: string): Promise<ReviewData[]> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      // Product identifier can be ASIN or product URL
      let productUrl: string;
      if (productIdentifier.startsWith('http')) {
        productUrl = productIdentifier;
      } else if (productIdentifier.match(/^[A-Z0-9]{10}$/)) {
        // ASIN format
        productUrl = `https://www.amazon.com/dp/${productIdentifier}`;
      } else {
        // Search for product
        const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(productIdentifier)}`;
        await this.navigateWithRetry(page, searchUrl);

        // Click on first product
        const firstProduct = await page.$('div[data-component-type="s-search-result"] h2 a');
        if (!firstProduct) {
          logger.warn('No Amazon product found', { productIdentifier });
          return [];
        }

        const href = await page.evaluate(el => el.getAttribute('href'), firstProduct);
        productUrl = `https://www.amazon.com${href}`;
      }

      // Navigate to product page
      await this.navigateWithRetry(page, productUrl);

      // Get product info
      const productInfo = await page.evaluate(() => {
        return {
          title: document.querySelector('#productTitle')?.textContent?.trim() || '',
          brand: document.querySelector('a#bylineInfo')?.textContent?.trim() || '',
          rating: document.querySelector('span[data-hook="rating-out-of-text"]')?.textContent?.trim() || '',
          totalReviews: document.querySelector('span[data-hook="total-review-count"]')?.textContent?.trim() || '',
        };
      });

      // Click on "See all reviews" link
      const allReviewsLink = await page.$('a[data-hook="see-all-reviews-link-foot"]');
      if (allReviewsLink) {
        await allReviewsLink.click();
        await page.waitForNavigation();
      }

      // Extract all reviews
      const allReviews: ReviewData[] = [];
      let hasNextPage = true;
      let pageNum = 1;

      while (hasNextPage && pageNum <= 10) { // Limit to 10 pages
        // Wait for reviews to load
        await page.waitForSelector('div[data-hook="review"]', { timeout: 10000 });

        // Extract reviews from current page
        const pageReviews = await this.extractReviewsFromPage(page, productInfo);
        allReviews.push(...pageReviews);

        // Check for next page
        const nextButton = await page.$('li.a-last:not(.a-disabled) a');
        if (nextButton) {
          await nextButton.click();
          await page.waitForTimeout(2000);
          pageNum++;
        } else {
          hasNextPage = false;
        }

        // Rate limiting
        await this.rateLimit();
      }

      return allReviews;
    } catch (error) {
      logger.error('Failed to scrape Amazon reviews', { error, productIdentifier });
      throw error;
    } finally {
      await browser.close();
    }
  }

  private async extractReviewsFromPage(page: puppeteer.Page, productInfo: any): Promise<ReviewData[]> {
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('div[data-hook="review"]');
      const reviewsData: any[] = [];

      reviewElements.forEach((element) => {
        // Extract rating
        const ratingEl = element.querySelector('i[data-hook="review-star-rating"]');
        const ratingText = ratingEl?.textContent || '';
        const rating = parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1] || '0');

        // Extract author
        const authorEl = element.querySelector('span.a-profile-name');
        const author = authorEl?.textContent?.trim() || 'Anonymous';

        // Extract date
        const dateEl = element.querySelector('span[data-hook="review-date"]');
        const dateText = dateEl?.textContent || '';
        const dateMatch = dateText.match(/on\s+(.+)$/);
        const dateValue = dateMatch ? dateMatch[1] : '';

        // Extract title
        const titleEl = element.querySelector('a[data-hook="review-title"] span:last-child');
        const title = titleEl?.textContent?.trim() || '';

        // Extract content
        const contentEl = element.querySelector('span[data-hook="review-body"]');
        const content = contentEl?.textContent?.trim() || '';

        // Check if verified purchase
        const verifiedEl = element.querySelector('span[data-hook="avp-badge"]');
        const verified = verifiedEl !== null;

        // Extract helpful votes
        const helpfulEl = element.querySelector('span[data-hook="helpful-vote-statement"]');
        const helpfulText = helpfulEl?.textContent || '';
        const helpfulMatch = helpfulText.match(/(\d+)/);
        const helpful = helpfulMatch ? parseInt(helpfulMatch[1]) : 0;

        // Extract variant info
        const variantEl = element.querySelector('a[data-hook="format-strip"]');
        const variant = variantEl?.textContent?.trim() || '';

        // Check for vine voice
        const vineEl = element.querySelector('span[class*="vine-voice"]');
        const isVineVoice = vineEl !== null;

        // Extract images
        const images = Array.from(element.querySelectorAll('img[data-hook="review-image-tile"]'))
          .map(img => img.getAttribute('src'))
          .filter(Boolean);

        reviewsData.push({
          rating,
          author,
          dateValue,
          title,
          content,
          verified,
          helpful,
          variant,
          isVineVoice,
          images,
        });
      });

      return reviewsData;
    });

    return reviews.map((review) => ({
      reviewId: this.generateReviewId('amazon'),
      author: review.author,
      rating: review.rating,
      title: review.title,
      content: this.sanitizeText(review.content),
      date: new Date(review.dateValue),
      verified: review.verified,
      helpful: review.helpful,
      source: this.sourceName,
      metadata: {
        platform: 'Amazon',
        productName: productInfo.title,
        brand: productInfo.brand,
        isVerifiedPurchase: review.verified,
        productVariant: review.variant,
        isVineVoice: review.isVineVoice,
        hasImages: review.images.length > 0,
        imageCount: review.images.length,
      },
    }));
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

        // Extract ASIN
        const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
        const asin = asinMatch ? asinMatch[1] : '';

        return {
          asin,
          title: getTextContent('#productTitle'),
          brand: getTextContent('a#bylineInfo'),
          price: getTextContent('span.a-price-whole'),
          rating: parseFloat(getTextContent('span.a-icon-alt') || '0'),
          totalReviews: getTextContent('#acrCustomerReviewText'),
          
          // Best seller rank
          bestSellerRank: getTextContent('#SalesRank'),
          
          // Categories
          categories: Array.from(document.querySelectorAll('.a-breadcrumb a'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
          
          // Features
          features: Array.from(document.querySelectorAll('#feature-bullets li'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
          
          // Rating breakdown
          ratingBreakdown: {
            5: getTextContent('tr.a-histogram-row:nth-child(1) .a-size-base'),
            4: getTextContent('tr.a-histogram-row:nth-child(2) .a-size-base'),
            3: getTextContent('tr.a-histogram-row:nth-child(3) .a-size-base'),
            2: getTextContent('tr.a-histogram-row:nth-child(4) .a-size-base'),
            1: getTextContent('tr.a-histogram-row:nth-child(5) .a-size-base'),
          },
          
          // Availability
          availability: getTextContent('#availability span'),
          
          // Frequently bought together
          frequentlyBoughtTogether: Array.from(document.querySelectorAll('#frequently-bought-together_feature_div .a-spacing-mini'))
            .map(el => el.textContent?.trim())
            .filter(Boolean),
        };
      });

      return details;
    } catch (error) {
      logger.error('Failed to get Amazon product details', { error, productUrl });
      throw error;
    } finally {
      await browser.close();
    }
  }

  async getSellerReviews(sellerName: string): Promise<ReviewData[]> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      // Search for seller
      const searchUrl = `https://www.amazon.com/s?me=${encodeURIComponent(sellerName)}`;
      await this.navigateWithRetry(page, searchUrl);

      // Click on seller profile if available
      const sellerLink = await page.$('a[href*="/sp?seller="]');
      if (!sellerLink) {
        logger.warn('Seller not found', { sellerName });
        return [];
      }

      await sellerLink.click();
      await page.waitForNavigation();

      // Navigate to feedback section
      const feedbackLink = await page.$('a[href*="feedback"]');
      if (feedbackLink) {
        await feedbackLink.click();
        await page.waitForNavigation();
      }

      // Extract seller feedback
      const reviews = await page.evaluate(() => {
        const feedbackElements = document.querySelectorAll('div.feedback-row');
        const reviewsData: any[] = [];

        feedbackElements.forEach((element) => {
          // Extract rating
          const stars = element.querySelectorAll('.a-icon-star');
          const rating = stars.length;

          // Extract date
          const dateEl = element.querySelector('.feedback-date');
          const dateText = dateEl?.textContent?.trim() || '';

          // Extract comment
          const commentEl = element.querySelector('.feedback-comment');
          const comment = commentEl?.textContent?.trim() || '';

          // Extract rater info
          const raterEl = element.querySelector('.feedback-rater');
          const rater = raterEl?.textContent?.trim() || 'Anonymous';

          reviewsData.push({
            rating,
            dateText,
            comment,
            rater,
          });
        });

        return reviewsData;
      });

      return reviews.map((review) => ({
        reviewId: this.generateReviewId('amazon-seller'),
        author: review.rater,
        rating: review.rating,
        title: '',
        content: this.sanitizeText(review.comment),
        date: new Date(review.dateText),
        verified: true, // All seller feedback is from verified purchases
        helpful: 0,
        source: 'Amazon Seller',
        metadata: {
          platform: 'Amazon',
          sellerName,
          reviewType: 'seller-feedback',
        },
      }));
    } catch (error) {
      logger.error('Failed to scrape Amazon seller reviews', { error, sellerName });
      throw error;
    } finally {
      await browser.close();
    }
  }
}