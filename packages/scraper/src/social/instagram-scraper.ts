import axios from 'axios';
import { logger } from '../logger';

export interface InstagramPost {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  permalink: string;
  timestamp: Date;
  username: string;
  likeCount: number;
  commentCount: number;
  hashtags: string[];
  mentions: string[];
  location?: {
    name: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface InstagramComment {
  id: string;
  postId: string;
  username: string;
  text: string;
  timestamp: Date;
  likeCount: number;
  replies?: InstagramComment[];
}

export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  profilePicUrl: string;
  isVerified: boolean;
  isBusinessAccount: boolean;
  businessCategory?: string;
  website?: string;
}

export class InstagramScraper {
  private accessToken: string;
  private apiVersion = 'v18.0';
  private baseUrl = 'https://graph.instagram.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async searchBusinessPosts(
    brandName: string,
    options: {
      hashtags?: string[];
      maxPosts?: number;
      mediaTypes?: Array<'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'>;
      sinceDate?: Date;
      untilDate?: Date;
    } = {}
  ): Promise<InstagramPost[]> {
    try {
      const {
        hashtags = [],
        maxPosts = 100,
        mediaTypes,
        sinceDate,
        untilDate,
      } = options;

      // Search by hashtags
      const hashtagsToSearch = [
        brandName.toLowerCase().replace(/\s+/g, ''),
        ...hashtags,
      ];

      const posts: InstagramPost[] = [];

      for (const hashtag of hashtagsToSearch) {
        const hashtagPosts = await this.getHashtagPosts(hashtag, {
          maxPosts: Math.ceil(maxPosts / hashtagsToSearch.length),
          mediaTypes,
          sinceDate,
          untilDate,
        });

        posts.push(...hashtagPosts);
      }

      // Filter posts that mention the brand
      const brandMentions = posts.filter(post => {
        const lowerCaption = post.caption.toLowerCase();
        const lowerBrand = brandName.toLowerCase();
        
        return (
          lowerCaption.includes(lowerBrand) ||
          post.mentions.some(mention => 
            mention.toLowerCase().includes(lowerBrand)
          )
        );
      });

      // Remove duplicates
      const uniquePosts = Array.from(
        new Map(brandMentions.map(post => [post.id, post])).values()
      );

      return uniquePosts.slice(0, maxPosts);
    } catch (error) {
      logger.error('Failed to search Instagram posts', { error, brandName });
      throw error;
    }
  }

  async getHashtagPosts(
    hashtag: string,
    options: {
      maxPosts?: number;
      mediaTypes?: Array<'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'>;
      sinceDate?: Date;
      untilDate?: Date;
    } = {}
  ): Promise<InstagramPost[]> {
    try {
      // First, get hashtag ID
      const hashtagSearchUrl = `${this.baseUrl}/ig_hashtag_search?user_id=${this.getUserId()}&q=${encodeURIComponent(hashtag)}&access_token=${this.accessToken}`;
      const hashtagResponse = await axios.get(hashtagSearchUrl);
      
      if (!hashtagResponse.data.data || hashtagResponse.data.data.length === 0) {
        return [];
      }

      const hashtagId = hashtagResponse.data.data[0].id;

      // Get recent media for hashtag
      const fields = 'id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count';
      const mediaUrl = `${this.baseUrl}/${hashtagId}/recent_media?user_id=${this.getUserId()}&fields=${fields}&access_token=${this.accessToken}`;
      
      const mediaResponse = await axios.get(mediaUrl);
      const posts: InstagramPost[] = [];

      for (const media of mediaResponse.data.data) {
        const post = this.parsePost(media);
        
        // Apply filters
        if (options.mediaTypes && !options.mediaTypes.includes(post.mediaType)) {
          continue;
        }
        
        if (options.sinceDate && post.timestamp < options.sinceDate) {
          continue;
        }
        
        if (options.untilDate && post.timestamp > options.untilDate) {
          continue;
        }

        posts.push(post);
        
        if (posts.length >= (options.maxPosts || 100)) {
          break;
        }
      }

      return posts;
    } catch (error) {
      logger.error('Failed to get hashtag posts', { error, hashtag });
      throw error;
    }
  }

  async getPostComments(postId: string): Promise<InstagramComment[]> {
    try {
      const fields = 'id,username,text,timestamp,like_count,replies{id,username,text,timestamp,like_count}';
      const url = `${this.baseUrl}/${postId}/comments?fields=${fields}&access_token=${this.accessToken}`;
      
      const response = await axios.get(url);
      const comments: InstagramComment[] = [];

      for (const comment of response.data.data) {
        comments.push({
          id: comment.id,
          postId,
          username: comment.username,
          text: comment.text,
          timestamp: new Date(comment.timestamp),
          likeCount: comment.like_count || 0,
          replies: comment.replies?.data?.map((reply: any) => ({
            id: reply.id,
            postId,
            username: reply.username,
            text: reply.text,
            timestamp: new Date(reply.timestamp),
            likeCount: reply.like_count || 0,
          })) || [],
        });
      }

      return comments;
    } catch (error) {
      logger.error('Failed to get post comments', { error, postId });
      throw error;
    }
  }

  async getBusinessProfile(username: string): Promise<InstagramProfile> {
    try {
      // Search for business account
      const searchUrl = `${this.baseUrl}/${this.apiVersion}/ig_user_search?q=${encodeURIComponent(username)}&access_token=${this.accessToken}`;
      const searchResponse = await axios.get(searchUrl);
      
      if (!searchResponse.data.data || searchResponse.data.data.length === 0) {
        throw new Error('Profile not found');
      }

      const userId = searchResponse.data.data[0].id;

      // Get profile details
      const fields = 'username,name,biography,followers_count,follows_count,media_count,profile_picture_url,is_verified,is_business_account,business_category_name,website';
      const profileUrl = `${this.baseUrl}/${userId}?fields=${fields}&access_token=${this.accessToken}`;
      
      const profileResponse = await axios.get(profileUrl);
      const profile = profileResponse.data;

      return {
        username: profile.username,
        fullName: profile.name,
        biography: profile.biography,
        followersCount: profile.followers_count,
        followingCount: profile.follows_count,
        postsCount: profile.media_count,
        profilePicUrl: profile.profile_picture_url,
        isVerified: profile.is_verified,
        isBusinessAccount: profile.is_business_account,
        businessCategory: profile.business_category_name,
        website: profile.website,
      };
    } catch (error) {
      logger.error('Failed to get Instagram profile', { error, username });
      throw error;
    }
  }

  async getLocationPosts(
    locationId: string,
    brandName: string,
    maxPosts: number = 50
  ): Promise<InstagramPost[]> {
    try {
      const fields = 'id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count';
      const url = `${this.baseUrl}/${locationId}/recent_media?fields=${fields}&access_token=${this.accessToken}`;
      
      const response = await axios.get(url);
      const posts: InstagramPost[] = [];

      for (const media of response.data.data) {
        const post = this.parsePost(media);
        
        // Filter for brand mentions
        if (this.containsBrandMention(post, brandName)) {
          posts.push(post);
        }
        
        if (posts.length >= maxPosts) {
          break;
        }
      }

      return posts;
    } catch (error) {
      logger.error('Failed to get location posts', { error, locationId });
      throw error;
    }
  }

  async searchLocations(query: string, latitude?: number, longitude?: number): Promise<Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>> {
    try {
      let url = `${this.baseUrl}/${this.apiVersion}/location_search?q=${encodeURIComponent(query)}&access_token=${this.accessToken}`;
      
      if (latitude && longitude) {
        url += `&lat=${latitude}&lng=${longitude}`;
      }

      const response = await axios.get(url);
      
      return response.data.data.map((location: any) => ({
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
      }));
    } catch (error) {
      logger.error('Failed to search locations', { error, query });
      throw error;
    }
  }

  private parsePost(media: any): InstagramPost {
    const caption = media.caption || '';
    
    return {
      id: media.id,
      caption,
      mediaType: media.media_type,
      mediaUrl: media.media_url,
      permalink: media.permalink,
      timestamp: new Date(media.timestamp),
      username: media.username,
      likeCount: media.like_count || 0,
      commentCount: media.comments_count || 0,
      hashtags: this.extractHashtags(caption),
      mentions: this.extractMentions(caption),
    };
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map(tag => tag.substring(1));
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@[a-zA-Z0-9_.]+/g;
    const matches = text.match(mentionRegex) || [];
    return matches.map(mention => mention.substring(1));
  }

  private containsBrandMention(post: InstagramPost, brandName: string): boolean {
    const lowerBrand = brandName.toLowerCase();
    const lowerCaption = post.caption.toLowerCase();
    
    return (
      lowerCaption.includes(lowerBrand) ||
      post.hashtags.some(tag => tag.toLowerCase().includes(lowerBrand)) ||
      post.mentions.some(mention => mention.toLowerCase().includes(lowerBrand))
    );
  }

  private getUserId(): string {
    // This should be retrieved from the Instagram Business Account
    // For now, returning a placeholder
    return process.env.INSTAGRAM_USER_ID || '';
  }

  async monitorHashtag(
    hashtag: string,
    onNewPost: (post: InstagramPost) => void,
    interval: number = 300000 // 5 minutes
  ): Promise<() => void> {
    const seenPosts = new Set<string>();
    let isMonitoring = true;

    const checkForNewPosts = async () => {
      try {
        const posts = await this.getHashtagPosts(hashtag, { maxPosts: 20 });
        
        for (const post of posts) {
          if (!seenPosts.has(post.id)) {
            seenPosts.add(post.id);
            onNewPost(post);
          }
        }
      } catch (error) {
        logger.error('Error monitoring hashtag', { error, hashtag });
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