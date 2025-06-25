import { TwitterApi } from 'twitter-api-v2';
import { logger } from '../logger';

export interface TwitterMention {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  createdAt: Date;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions?: number;
  };
  sentiment?: 'positive' | 'negative' | 'neutral';
  inReplyToId?: string;
  conversationId?: string;
  entities?: {
    hashtags?: string[];
    mentions?: string[];
    urls?: string[];
  };
  isVerified?: boolean;
}

export class TwitterMentionsCollector {
  private client: TwitterApi;
  private v2Client: any;

  constructor(bearerToken: string) {
    this.client = new TwitterApi(bearerToken);
    this.v2Client = this.client.v2;
  }

  async collectMentions(
    brandName: string,
    options: {
      maxResults?: number;
      startTime?: Date;
      endTime?: Date;
      includeReplies?: boolean;
      excludeRetweets?: boolean;
    } = {}
  ): Promise<TwitterMention[]> {
    try {
      const {
        maxResults = 100,
        startTime,
        endTime = new Date(),
        includeReplies = true,
        excludeRetweets = true,
      } = options;

      // Build search query
      let query = `"${brandName}"`;
      if (excludeRetweets) {
        query += ' -is:retweet';
      }
      if (!includeReplies) {
        query += ' -is:reply';
      }

      // Search parameters
      const searchParams: any = {
        query,
        max_results: Math.min(maxResults, 100),
        'tweet.fields': [
          'created_at',
          'author_id',
          'conversation_id',
          'in_reply_to_user_id',
          'public_metrics',
          'entities',
        ],
        'user.fields': ['name', 'username', 'verified'],
        expansions: ['author_id'],
      };

      if (startTime) {
        searchParams.start_time = startTime.toISOString();
      }
      if (endTime) {
        searchParams.end_time = endTime.toISOString();
      }

      // Perform search
      const tweets = await this.v2Client.search(searchParams);
      const mentions: TwitterMention[] = [];

      // Process results
      for await (const tweet of tweets) {
        const author = tweets.includes.users.find((u: any) => u.id === tweet.author_id);
        
        mentions.push({
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          authorUsername: author?.username || 'unknown',
          authorName: author?.name || 'Unknown',
          createdAt: new Date(tweet.created_at),
          metrics: {
            likes: tweet.public_metrics.like_count,
            retweets: tweet.public_metrics.retweet_count,
            replies: tweet.public_metrics.reply_count,
            impressions: tweet.public_metrics.impression_count,
          },
          inReplyToId: tweet.in_reply_to_user_id,
          conversationId: tweet.conversation_id,
          entities: {
            hashtags: tweet.entities?.hashtags?.map((h: any) => h.tag),
            mentions: tweet.entities?.mentions?.map((m: any) => m.username),
            urls: tweet.entities?.urls?.map((u: any) => u.expanded_url),
          },
          isVerified: author?.verified || false,
        });
      }

      // Analyze sentiment for each mention
      for (const mention of mentions) {
        mention.sentiment = this.analyzeSentiment(mention.text);
      }

      return mentions;
    } catch (error) {
      logger.error('Failed to collect Twitter mentions', { error, brandName });
      throw error;
    }
  }

  async getConversationThread(conversationId: string): Promise<TwitterMention[]> {
    try {
      const conversation = await this.v2Client.search({
        query: `conversation_id:${conversationId}`,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
        'user.fields': ['name', 'username', 'verified'],
        expansions: ['author_id'],
        max_results: 100,
      });

      const thread: TwitterMention[] = [];

      for await (const tweet of conversation) {
        const author = conversation.includes.users.find((u: any) => u.id === tweet.author_id);
        
        thread.push({
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          authorUsername: author?.username || 'unknown',
          authorName: author?.name || 'Unknown',
          createdAt: new Date(tweet.created_at),
          metrics: {
            likes: tweet.public_metrics.like_count,
            retweets: tweet.public_metrics.retweet_count,
            replies: tweet.public_metrics.reply_count,
          },
          conversationId,
          isVerified: author?.verified || false,
        });
      }

      return thread.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      logger.error('Failed to get conversation thread', { error, conversationId });
      throw error;
    }
  }

  async trackHashtag(hashtag: string, brandName?: string): Promise<TwitterMention[]> {
    try {
      let query = `#${hashtag}`;
      if (brandName) {
        query += ` "${brandName}"`;
      }

      const tweets = await this.v2Client.search({
        query,
        max_results: 100,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'entities'],
        'user.fields': ['name', 'username', 'verified', 'public_metrics'],
        expansions: ['author_id'],
      });

      const mentions: TwitterMention[] = [];

      for await (const tweet of tweets) {
        const author = tweets.includes.users.find((u: any) => u.id === tweet.author_id);
        
        mentions.push({
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          authorUsername: author?.username || 'unknown',
          authorName: author?.name || 'Unknown',
          createdAt: new Date(tweet.created_at),
          metrics: {
            likes: tweet.public_metrics.like_count,
            retweets: tweet.public_metrics.retweet_count,
            replies: tweet.public_metrics.reply_count,
          },
          entities: {
            hashtags: tweet.entities?.hashtags?.map((h: any) => h.tag),
          },
          isVerified: author?.verified || false,
          sentiment: this.analyzeSentiment(tweet.text),
        });
      }

      return mentions;
    } catch (error) {
      logger.error('Failed to track hashtag', { error, hashtag });
      throw error;
    }
  }

  async getInfluencerMentions(brandName: string, minFollowers: number = 10000): Promise<TwitterMention[]> {
    try {
      const query = `"${brandName}" -is:retweet`;
      
      const tweets = await this.v2Client.search({
        query,
        max_results: 100,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
        'user.fields': ['name', 'username', 'verified', 'public_metrics'],
        expansions: ['author_id'],
      });

      const influencerMentions: TwitterMention[] = [];

      for await (const tweet of tweets) {
        const author = tweets.includes.users.find((u: any) => u.id === tweet.author_id);
        
        // Filter by follower count
        if (author?.public_metrics?.followers_count >= minFollowers) {
          influencerMentions.push({
            id: tweet.id,
            text: tweet.text,
            authorId: tweet.author_id,
            authorUsername: author.username,
            authorName: author.name,
            createdAt: new Date(tweet.created_at),
            metrics: {
              likes: tweet.public_metrics.like_count,
              retweets: tweet.public_metrics.retweet_count,
              replies: tweet.public_metrics.reply_count,
            },
            isVerified: author.verified,
            sentiment: this.analyzeSentiment(tweet.text),
          });
        }
      }

      return influencerMentions;
    } catch (error) {
      logger.error('Failed to get influencer mentions', { error, brandName });
      throw error;
    }
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    // Simple sentiment analysis - in production would use NLP service
    const positiveWords = ['love', 'great', 'excellent', 'amazing', 'best', 'awesome', 'fantastic'];
    const negativeWords = ['hate', 'terrible', 'worst', 'awful', 'horrible', 'bad', 'disappointed'];
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score--;
    });
    
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  async streamMentions(
    brandName: string,
    onMention: (mention: TwitterMention) => void
  ): Promise<() => void> {
    try {
      // Set up filtered stream rules
      await this.v2Client.updateStreamRules({
        add: [{ value: brandName, tag: `brand-${brandName}` }],
      });

      // Start streaming
      const stream = await this.v2Client.searchStream({
        'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
        'user.fields': ['name', 'username', 'verified'],
        expansions: ['author_id'],
      });

      stream.on('data', (tweet: any) => {
        const mention: TwitterMention = {
          id: tweet.data.id,
          text: tweet.data.text,
          authorId: tweet.data.author_id,
          authorUsername: tweet.includes?.users?.[0]?.username || 'unknown',
          authorName: tweet.includes?.users?.[0]?.name || 'Unknown',
          createdAt: new Date(tweet.data.created_at),
          metrics: {
            likes: 0,
            retweets: 0,
            replies: 0,
          },
          sentiment: this.analyzeSentiment(tweet.data.text),
        };

        onMention(mention);
      });

      // Return cleanup function
      return () => {
        stream.close();
      };
    } catch (error) {
      logger.error('Failed to stream mentions', { error, brandName });
      throw error;
    }
  }
}