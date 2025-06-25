import { useState, useEffect, useCallback } from 'react';
import { Review, ReviewFilter } from '../types';
import { ReviewInsightsSDK } from '../ReviewInsightsSDK';

interface UseReviewsResult {
  reviews: Review[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  filter: ReviewFilter;
  setFilter: (filter: ReviewFilter) => void;
}

export const useReviews = (
  initialFilter?: ReviewFilter,
  options?: {
    pageSize?: number;
    autoFetch?: boolean;
  }
): UseReviewsResult => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>({
    limit: options?.pageSize || 20,
    offset: 0,
    sortBy: 'date',
    sortOrder: 'desc',
    ...initialFilter,
  });

  const fetchReviews = useCallback(
    async (append: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

        const sdk = ReviewInsightsSDK.getInstance();
        const fetchedReviews = await sdk.getReviews(filter);

        if (append) {
          setReviews((prev) => [...prev, ...fetchedReviews]);
        } else {
          setReviews(fetchedReviews);
        }

        setHasMore(fetchedReviews.length === (filter.limit || 20));
      } catch (err) {
        setError(err as Error);
        console.error('Failed to fetch reviews:', err);
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  const refetch = useCallback(async () => {
    setFilter((prev) => ({ ...prev, offset: 0 }));
    await fetchReviews(false);
  }, [fetchReviews]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    setFilter((prev) => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 20),
    }));
  }, [hasMore, loading]);

  useEffect(() => {
    if (options?.autoFetch !== false) {
      fetchReviews(filter.offset !== 0);
    }
  }, [filter, options?.autoFetch]);

  return {
    reviews,
    loading,
    error,
    refetch,
    loadMore,
    hasMore,
    filter,
    setFilter,
  };
};