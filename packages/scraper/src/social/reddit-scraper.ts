import axios from 'axios';
import { logger } from '../logger';

export interface RedditPost {
  id: string;
  title: string;
  content: string;
  author: string;
  subreddit: string;
  score: number;
  upvoteRatio: number;
  numComments: number;
  created: Date;
  url: string;
  permalink: string;
  isStickied: boolean;
  awards: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface RedditComment {
  id: string;
  postId: string;
  parentId?: string;
  author: string;
  content: string;
  score: number;
  created: Date;
  edited: boolean;
  depth: number;
  permalink: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export class RedditScraper {
  private userAgent = 'ReviewInsightsBot/1.0';
  private baseUrl = 'https://www.reddit.com';

  async searchBrandMentions(
    brandName: string,
    options: {
      subreddits?: string[];
      timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      sortBy?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
      limit?: number;
    } = {}
  ): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
    try {
      const {
        subreddits = [],
        timeRange = 'month',
        sortBy = 'relevance',
        limit = 100,
      } = options;

      const posts: RedditPost[] = [];
      const comments: RedditComment[] = [];

      // Search in specific subreddits or all
      const searchQuery = subreddits.length > 0
        ? `"${brandName}" subreddit:${subreddits.join('+subreddit:')}`
        : `"${brandName}"`;

      // Search posts
      const postsUrl = `${this.baseUrl}/search.json?q=${encodeURIComponent(searchQuery)}&sort=${sortBy}&t=${timeRange}&limit=${limit}&type=link`;
      const postsResponse = await this.makeRequest(postsUrl);

      for (const post of postsResponse.data.children) {
        const postData = post.data;
        posts.push({
          id: postData.id,
          title: postData.title,
          content: postData.selftext || '',
          author: postData.author,
          subreddit: postData.subreddit,
          score: postData.score,
          upvoteRatio: postData.upvote_ratio,
          numComments: postData.num_comments,
          created: new Date(postData.created_utc * 1000),
          url: postData.url,
          permalink: `${this.baseUrl}${postData.permalink}`,
          isStickied: postData.stickied,
          awards: postData.total_awards_received || 0,
          sentiment: this.analyzeSentiment(postData.title + ' ' + (postData.selftext || '')),
        });
      }

      // Search comments
      const commentsUrl = `${this.baseUrl}/search.json?q=${encodeURIComponent(searchQuery)}&sort=${sortBy}&t=${timeRange}&limit=${limit}&type=comment`;
      const commentsResponse = await this.makeRequest(commentsUrl);

      for (const comment of commentsResponse.data.children) {
        const commentData = comment.data;
        comments.push({
          id: commentData.id,
          postId: commentData.link_id?.replace('t3_', '') || '',
          parentId: commentData.parent_id?.replace(/t[0-9]_/, ''),
          author: commentData.author,
          content: commentData.body,
          score: commentData.score,
          created: new Date(commentData.created_utc * 1000),
          edited: commentData.edited !== false,
          depth: commentData.depth || 0,
          permalink: `${this.baseUrl}${commentData.permalink}`,
          sentiment: this.analyzeSentiment(commentData.body),
        });
      }

      return { posts, comments };
    } catch (error) {
      logger.error('Failed to search Reddit mentions', { error, brandName });
      throw error;
    }
  }

  async getSubredditPosts(
    subreddit: string,
    options: {
      sortBy?: 'hot' | 'new' | 'top' | 'rising';
      timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
    } = {}
  ): Promise<RedditPost[]> {
    try {
      const { sortBy = 'hot', timeRange = 'day', limit = 25 } = options;

      const url = `${this.baseUrl}/r/${subreddit}/${sortBy}.json?t=${timeRange}&limit=${limit}`;
      const response = await this.makeRequest(url);

      const posts: RedditPost[] = [];

      for (const post of response.data.children) {
        const postData = post.data;
        posts.push({
          id: postData.id,
          title: postData.title,
          content: postData.selftext || '',
          author: postData.author,
          subreddit: postData.subreddit,
          score: postData.score,
          upvoteRatio: postData.upvote_ratio,
          numComments: postData.num_comments,
          created: new Date(postData.created_utc * 1000),
          url: postData.url,
          permalink: `${this.baseUrl}${postData.permalink}`,
          isStickied: postData.stickied,
          awards: postData.total_awards_received || 0,
        });
      }

      return posts;
    } catch (error) {
      logger.error('Failed to get subreddit posts', { error, subreddit });
      throw error;
    }
  }

  async getPostComments(postId: string, subreddit: string): Promise<RedditComment[]> {
    try {
      const url = `${this.baseUrl}/r/${subreddit}/comments/${postId}.json`;
      const response = await this.makeRequest(url);

      const comments: RedditComment[] = [];

      // Reddit returns two listings: post and comments
      if (response.length > 1) {
        this.extractComments(response[1].data.children, comments, postId);
      }

      return comments;
    } catch (error) {
      logger.error('Failed to get post comments', { error, postId });
      throw error;
    }
  }

  private extractComments(
    children: any[],
    comments: RedditComment[],
    postId: string,
    parentId?: string,
    depth: number = 0
  ): void {
    for (const child of children) {
      if (child.kind === 't1') { // Comment
        const commentData = child.data;
        
        const comment: RedditComment = {
          id: commentData.id,
          postId,
          parentId,
          author: commentData.author,
          content: commentData.body,
          score: commentData.score,
          created: new Date(commentData.created_utc * 1000),
          edited: commentData.edited !== false,
          depth,
          permalink: `${this.baseUrl}${commentData.permalink}`,
          sentiment: this.analyzeSentiment(commentData.body),
        };
        
        comments.push(comment);

        // Process replies
        if (commentData.replies && commentData.replies.data && commentData.replies.data.children) {
          this.extractComments(
            commentData.replies.data.children,
            comments,
            postId,
            commentData.id,
            depth + 1
          );
        }
      }
    }
  }

  async getRelatedSubreddits(brandName: string, industry?: string): Promise<string[]> {
    const relatedSubreddits: string[] = [];

    // Industry-specific subreddits
    const industrySubreddits: Record<string, string[]> = {
      'Technology': ['technology', 'gadgets', 'tech', 'programming', 'apple', 'android'],
      'Gaming': ['gaming', 'pcgaming', 'PS5', 'xbox', 'NintendoSwitch', 'steamdeck'],
      'Finance': ['personalfinance', 'investing', 'cryptocurrency', 'wallstreetbets', 'stocks'],
      'E-commerce': ['Entrepreneur', 'ecommerce', 'shopify', 'FulfillmentByAmazon'],
      'Food': ['food', 'cooking', 'recipes', 'foodporn', 'MealPrepSunday'],
      'Fashion': ['fashion', 'streetwear', 'malefashionadvice', 'femalefashionadvice'],
      'Fitness': ['fitness', 'gym', 'bodybuilding', 'running', 'yoga'],
      'Travel': ['travel', 'solotravel', 'backpacking', 'digitalnomad'],
    };

    // Add industry-specific subreddits
    if (industry && industrySubreddits[industry]) {
      relatedSubreddits.push(...industrySubreddits[industry]);
    }

    // Add general discussion subreddits
    relatedSubreddits.push(
      'AskReddit',
      'explainlikeimfive',
      'NoStupidQuestions',
      'OutOfTheLoop',
      'bestof'
    );

    // Search for brand-specific subreddit
    try {
      const searchUrl = `${this.baseUrl}/subreddits/search.json?q=${encodeURIComponent(brandName)}&limit=5`;
      const response = await this.makeRequest(searchUrl);
      
      for (const subreddit of response.data.children) {
        if (subreddit.data.subscribers > 1000) {
          relatedSubreddits.push(subreddit.data.display_name);
        }
      }
    } catch (error) {
      logger.warn('Failed to search for brand subreddit', { error, brandName });
    }

    return [...new Set(relatedSubreddits)];
  }

  private async makeRequest(url: string): Promise<any> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        // Rate limited - wait and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.makeRequest(url);
      }
      throw error;
    }
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lowerText = text.toLowerCase();
    
    // Reddit-specific positive indicators
    const positivePatterns = [
      'love', 'great', 'excellent', 'amazing', 'best', 'awesome',
      'recommend', 'worth it', '10/10', 'must have', 'game changer',
      '🔥', '💯', '👍', '❤️', '😍'
    ];
    
    // Reddit-specific negative indicators
    const negativePatterns = [
      'hate', 'terrible', 'worst', 'awful', 'garbage', 'trash',
      'scam', 'ripoff', 'avoid', 'disappointed', 'regret',
      '👎', '😡', '🤮', '💩'
    ];
    
    let score = 0;
    
    positivePatterns.forEach(pattern => {
      if (lowerText.includes(pattern)) score++;
    });
    
    negativePatterns.forEach(pattern => {
      if (lowerText.includes(pattern)) score--;
    });
    
    // Check for sarcasm indicators
    if (lowerText.includes('/s') || lowerText.includes('sarcasm')) {
      score = -score; // Flip the sentiment
    }
    
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  async monitorSubreddit(
    subreddit: string,
    brandName: string,
    onNewPost: (post: RedditPost) => void,
    onNewComment: (comment: RedditComment) => void
  ): Promise<() => void> {
    let isMonitoring = true;
    const seenPosts = new Set<string>();
    const seenComments = new Set<string>();

    const monitor = async () => {
      while (isMonitoring) {
        try {
          // Check new posts
          const posts = await this.getSubredditPosts(subreddit, { sortBy: 'new', limit: 25 });
          
          for (const post of posts) {
            if (!seenPosts.has(post.id) && 
                (post.title.toLowerCase().includes(brandName.toLowerCase()) ||
                 post.content.toLowerCase().includes(brandName.toLowerCase()))) {
              seenPosts.add(post.id);
              onNewPost(post);
            }
          }

          // Check comments on recent posts
          for (const post of posts.slice(0, 10)) {
            const comments = await this.getPostComments(post.id, subreddit);
            
            for (const comment of comments) {
              if (!seenComments.has(comment.id) &&
                  comment.content.toLowerCase().includes(brandName.toLowerCase())) {
                seenComments.add(comment.id);
                onNewComment(comment);
              }
            }
          }

          // Wait before next check
          await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
        } catch (error) {
          logger.error('Error monitoring subreddit', { error, subreddit });
          await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes on error
        }
      }
    };

    // Start monitoring
    monitor();

    // Return cleanup function
    return () => {
      isMonitoring = false;
    };
  }
}