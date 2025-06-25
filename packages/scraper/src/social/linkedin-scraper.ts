import axios from 'axios';
import { logger } from '../logger';

export interface LinkedInPost {
  id: string;
  text: string;
  authorName: string;
  authorTitle: string;
  authorProfileUrl: string;
  companyName?: string;
  publishedAt: Date;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  postUrl: string;
  mediaType?: 'article' | 'image' | 'video' | 'document';
  mediaUrl?: string;
  hashtags: string[];
  mentions: string[];
}

export interface LinkedInComment {
  id: string;
  postId: string;
  text: string;
  authorName: string;
  authorTitle: string;
  publishedAt: Date;
  likeCount: number;
  replies?: LinkedInComment[];
}

export interface LinkedInCompanyPage {
  id: string;
  name: string;
  description: string;
  industry: string;
  companySize: string;
  website: string;
  logoUrl: string;
  followerCount: number;
  employeeCount: number;
  specialties: string[];
  locations: Array<{
    city: string;
    country: string;
    isHeadquarters: boolean;
  }>;
}

export class LinkedInScraper {
  private accessToken: string;
  private apiVersion = 'v2';
  private baseUrl = 'https://api.linkedin.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async searchCompanyPosts(
    companyName: string,
    options: {
      maxPosts?: number;
      sinceDate?: Date;
      untilDate?: Date;
      includeEmployeePosts?: boolean;
    } = {}
  ): Promise<LinkedInPost[]> {
    try {
      const {
        maxPosts = 100,
        sinceDate,
        untilDate,
        includeEmployeePosts = false,
      } = options;

      // First, find the company
      const company = await this.searchCompany(companyName);
      if (!company) {
        logger.warn('Company not found on LinkedIn', { companyName });
        return [];
      }

      const posts: LinkedInPost[] = [];

      // Get company posts
      const companyPosts = await this.getCompanyPosts(company.id, {
        maxPosts,
        sinceDate,
        untilDate,
      });
      posts.push(...companyPosts);

      // Get employee posts if requested
      if (includeEmployeePosts) {
        const employeePosts = await this.getEmployeePosts(company.id, companyName, {
          maxPosts: Math.floor(maxPosts / 2),
          sinceDate,
          untilDate,
        });
        posts.push(...employeePosts);
      }

      // Sort by date and limit
      return posts
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, maxPosts);
    } catch (error) {
      logger.error('Failed to search LinkedIn company posts', { error, companyName });
      throw error;
    }
  }

  private async searchCompany(companyName: string): Promise<LinkedInCompanyPage | null> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/companies?q=search&keywords=${encodeURIComponent(companyName)}`;
      const response = await this.makeRequest(url);

      if (!response.data.elements || response.data.elements.length === 0) {
        return null;
      }

      const company = response.data.elements[0];
      return this.parseCompanyPage(company);
    } catch (error) {
      logger.error('Failed to search company', { error, companyName });
      return null;
    }
  }

  private async getCompanyPosts(
    companyId: string,
    options: {
      maxPosts?: number;
      sinceDate?: Date;
      untilDate?: Date;
    }
  ): Promise<LinkedInPost[]> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/ugcPosts?q=authors&authors=urn:li:organization:${companyId}`;
      const response = await this.makeRequest(url);

      const posts: LinkedInPost[] = [];

      for (const element of response.data.elements) {
        const post = await this.parsePost(element);
        
        // Apply date filters
        if (options.sinceDate && post.publishedAt < options.sinceDate) continue;
        if (options.untilDate && post.publishedAt > options.untilDate) continue;
        
        posts.push(post);
        
        if (posts.length >= (options.maxPosts || 100)) break;
      }

      return posts;
    } catch (error) {
      logger.error('Failed to get company posts', { error, companyId });
      return [];
    }
  }

  private async getEmployeePosts(
    companyId: string,
    companyName: string,
    options: {
      maxPosts?: number;
      sinceDate?: Date;
      untilDate?: Date;
    }
  ): Promise<LinkedInPost[]> {
    try {
      // Search for posts mentioning the company
      const searchUrl = `${this.baseUrl}/${this.apiVersion}/ugcPosts?q=keywords&keywords=${encodeURIComponent(companyName)}`;
      const response = await this.makeRequest(searchUrl);

      const posts: LinkedInPost[] = [];

      for (const element of response.data.elements) {
        // Check if author is associated with the company
        if (element.author && element.author.includes('person')) {
          const post = await this.parsePost(element);
          
          // Apply filters
          if (options.sinceDate && post.publishedAt < options.sinceDate) continue;
          if (options.untilDate && post.publishedAt > options.untilDate) continue;
          
          posts.push(post);
          
          if (posts.length >= (options.maxPosts || 50)) break;
        }
      }

      return posts;
    } catch (error) {
      logger.error('Failed to get employee posts', { error, companyId });
      return [];
    }
  }

  async getPostComments(postId: string): Promise<LinkedInComment[]> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/socialActions/${postId}/comments`;
      const response = await this.makeRequest(url);

      const comments: LinkedInComment[] = [];

      for (const element of response.data.elements) {
        const comment = this.parseComment(element, postId);
        comments.push(comment);
      }

      return comments;
    } catch (error) {
      logger.error('Failed to get post comments', { error, postId });
      return [];
    }
  }

  async getCompanyDetails(companyId: string): Promise<LinkedInCompanyPage> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/organizations/${companyId}`;
      const response = await this.makeRequest(url);
      
      return this.parseCompanyPage(response.data);
    } catch (error) {
      logger.error('Failed to get company details', { error, companyId });
      throw error;
    }
  }

  async searchPosts(
    query: string,
    options: {
      maxPosts?: number;
      postType?: 'all' | 'articles' | 'videos';
      authorType?: 'all' | 'companies' | 'people';
      sortBy?: 'relevance' | 'recency';
    } = {}
  ): Promise<LinkedInPost[]> {
    try {
      const {
        maxPosts = 100,
        postType = 'all',
        authorType = 'all',
        sortBy = 'relevance',
      } = options;

      const url = `${this.baseUrl}/${this.apiVersion}/ugcPosts?q=keywords&keywords=${encodeURIComponent(query)}&sortBy=${sortBy}`;
      const response = await this.makeRequest(url);

      const posts: LinkedInPost[] = [];

      for (const element of response.data.elements) {
        // Apply filters
        if (authorType === 'companies' && !element.author.includes('organization')) continue;
        if (authorType === 'people' && !element.author.includes('person')) continue;

        const post = await this.parsePost(element);
        
        // Filter by post type
        if (postType === 'articles' && post.mediaType !== 'article') continue;
        if (postType === 'videos' && post.mediaType !== 'video') continue;
        
        posts.push(post);
        
        if (posts.length >= maxPosts) break;
      }

      return posts;
    } catch (error) {
      logger.error('Failed to search posts', { error, query });
      throw error;
    }
  }

  private async parsePost(element: any): Promise<LinkedInPost> {
    const text = element.specificContent?.ugcPostContent?.shareCommentary?.text || '';
    
    // Extract author info
    let authorName = 'Unknown';
    let authorTitle = '';
    let companyName = '';
    
    if (element.author) {
      if (element.author.includes('organization')) {
        // Company post
        const orgId = element.author.split(':').pop();
        const orgDetails = await this.getBasicOrgInfo(orgId);
        authorName = orgDetails.name;
        companyName = orgDetails.name;
      } else if (element.author.includes('person')) {
        // Person post
        const personId = element.author.split(':').pop();
        const personDetails = await this.getBasicPersonInfo(personId);
        authorName = personDetails.name;
        authorTitle = personDetails.title;
        companyName = personDetails.company;
      }
    }

    // Extract media info
    let mediaType: LinkedInPost['mediaType'];
    let mediaUrl: string | undefined;
    
    if (element.specificContent?.ugcPostContent?.media) {
      const media = element.specificContent.ugcPostContent.media[0];
      if (media.mediaType === 'ARTICLE') mediaType = 'article';
      else if (media.mediaType === 'IMAGE') mediaType = 'image';
      else if (media.mediaType === 'VIDEO') mediaType = 'video';
      else if (media.mediaType === 'DOCUMENT') mediaType = 'document';
      
      mediaUrl = media.url || media.thumbnailUrl;
    }

    return {
      id: element.id,
      text,
      authorName,
      authorTitle,
      authorProfileUrl: `https://www.linkedin.com/in/${element.author.split(':').pop()}`,
      companyName,
      publishedAt: new Date(element.created),
      likeCount: element.likesSummary?.totalLikes || 0,
      commentCount: element.commentsSummary?.totalComments || 0,
      shareCount: element.sharesSummary?.totalShares || 0,
      postUrl: `https://www.linkedin.com/feed/update/${element.id}`,
      mediaType,
      mediaUrl,
      hashtags: this.extractHashtags(text),
      mentions: this.extractMentions(text),
    };
  }

  private parseComment(element: any, postId: string): LinkedInComment {
    return {
      id: element.id,
      postId,
      text: element.message?.text || '',
      authorName: element.actor?.name?.localized?.en_US || 'Unknown',
      authorTitle: element.actor?.headline?.localized?.en_US || '',
      publishedAt: new Date(element.created),
      likeCount: element.likesSummary?.totalLikes || 0,
      replies: element.comments?.elements?.map((reply: any) => 
        this.parseComment(reply, postId)
      ) || [],
    };
  }

  private parseCompanyPage(data: any): LinkedInCompanyPage {
    return {
      id: data.id,
      name: data.localizedName || data.name?.localized?.en_US || '',
      description: data.description?.localized?.en_US || '',
      industry: data.industries?.[0]?.localized?.en_US || '',
      companySize: data.staffCountRange || '',
      website: data.websiteUrl || '',
      logoUrl: data.logoV2?.original || '',
      followerCount: data.followerCount || 0,
      employeeCount: data.staffCount || 0,
      specialties: data.specialties || [],
      locations: (data.locations || []).map((loc: any) => ({
        city: loc.city,
        country: loc.country,
        isHeadquarters: loc.isHeadquarters || false,
      })),
    };
  }

  private async getBasicOrgInfo(orgId: string): Promise<{ name: string }> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/organizations/${orgId}?projection=(localizedName)`;
      const response = await this.makeRequest(url);
      return { name: response.data.localizedName || 'Unknown Company' };
    } catch {
      return { name: 'Unknown Company' };
    }
  }

  private async getBasicPersonInfo(personId: string): Promise<{
    name: string;
    title: string;
    company: string;
  }> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/people/${personId}?projection=(firstName,lastName,headline)`;
      const response = await this.makeRequest(url);
      
      const firstName = response.data.firstName?.localized?.en_US || '';
      const lastName = response.data.lastName?.localized?.en_US || '';
      const headline = response.data.headline?.localized?.en_US || '';
      
      // Extract company from headline (usually format: "Title at Company")
      const headlineParts = headline.split(' at ');
      const title = headlineParts[0] || '';
      const company = headlineParts[1] || '';
      
      return {
        name: `${firstName} ${lastName}`.trim() || 'Unknown',
        title,
        company,
      };
    } catch {
      return { name: 'Unknown', title: '', company: '' };
    }
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map(tag => tag.substring(1));
  }

  private extractMentions(text: string): string[] {
    // LinkedIn uses different mention format
    const mentionRegex = /@\[([^\]]+)\]/g;
    const matches = text.matchAll(mentionRegex);
    return Array.from(matches).map(match => match[1]);
  }

  private async makeRequest(url: string): Promise<any> {
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        // Rate limited - wait and retry
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
        return this.makeRequest(url);
      }
      throw error;
    }
  }

  async monitorCompany(
    companyId: string,
    onNewPost: (post: LinkedInPost) => void,
    interval: number = 3600000 // 1 hour
  ): Promise<() => void> {
    const seenPosts = new Set<string>();
    let isMonitoring = true;

    const checkForNewPosts = async () => {
      try {
        const posts = await this.getCompanyPosts(companyId, { maxPosts: 10 });
        
        for (const post of posts) {
          if (!seenPosts.has(post.id)) {
            seenPosts.add(post.id);
            onNewPost(post);
          }
        }
      } catch (error) {
        logger.error('Error monitoring company', { error, companyId });
      }
    };

    // Initial check
    checkForNewPosts();

    // Set up interval
    const intervalId = setInterval(() => {
      if (isMonitoring) {
        checkForNewPosts();
      }
    }, interval);

    // Return cleanup function
    return () => {
      isMonitoring = false;
      clearInterval(intervalId);
    };
  }
}