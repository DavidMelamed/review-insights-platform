export interface DataForSEOConfig {
  email: string;
  password: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: {
    maxConcurrent?: number;
    minTime?: number;
  };
}

export interface DataForSEOReview {
  type: string;
  rank_group: number;
  rank_absolute: number;
  position: string;
  rating: {
    rating_type: string;
    value: number;
    votes_count: number;
    rating_max: number;
  };
  timestamp: string;
  datetime: string;
  author_name: string;
  author_id: string;
  author_url: string;
  author_image_url: string;
  review_text: string;
  review_images: string[];
  owner_answer: string | null;
  owner_timestamp: string | null;
  owner_datetime: string | null;
  review_id: string;
  review_url: string;
  review_rating: number;
  review_helpful_count: number;
  language: string;
  is_local_guide?: boolean;
  profile_photos_count?: number;
  reviews_count?: number;
}

export interface DataForSEOTaskResult {
  task_id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: {
    api: string;
    function: string;
  };
  result: Array<{
    type: string;
    se_domain: string;
    location_code: number;
    language_code: string;
    total_count: number;
    count: number;
    items_count: number;
    items: DataForSEOReview[];
  }>;
}

export interface DataForSEOTaskPost {
  keyword: string;
  location_name?: string;
  location_code?: number;
  language_name?: string;
  language_code?: string;
  depth?: number;
  rating_filter?: number[];
  visit_type?: string;
  sort_by?: 'newest' | 'highest_rating' | 'lowest_rating' | 'most_relevant';
  tag?: string;
  postback_url?: string;
  pingback_url?: string;
}

export interface DataForSEOError {
  code: number;
  message: string;
  details?: any;
}

export interface DataForSEOResponse<T> {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: T[];
}

export type Platform = 'google' | 'yelp' | 'trustpilot' | 'tripadvisor' | 'facebook';

export interface PlatformEndpoints {
  google: {
    reviews: '/v3/business_data/google/reviews/task_post';
    taskGet: '/v3/business_data/google/reviews/task_get';
  };
  yelp: {
    reviews: '/v3/business_data/yelp/reviews/task_post';
    taskGet: '/v3/business_data/yelp/reviews/task_get';
  };
  trustpilot: {
    reviews: '/v3/business_data/trustpilot/reviews/task_post';
    taskGet: '/v3/business_data/trustpilot/reviews/task_get';
  };
  tripadvisor: {
    reviews: '/v3/business_data/tripadvisor/reviews/task_post';
    taskGet: '/v3/business_data/tripadvisor/reviews/task_get';
  };
}