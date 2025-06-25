import { useState, useEffect, useCallback } from 'react';
import { ReviewAnalytics } from '../types';
import { ReviewInsightsSDK } from '../ReviewInsightsSDK';

interface UseReviewAnalyticsResult {
  analytics: ReviewAnalytics | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useReviewAnalytics = (
  options?: {
    autoFetch?: boolean;
    refreshInterval?: number; // in milliseconds
  }
): UseReviewAnalyticsResult => {
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const sdk = ReviewInsightsSDK.getInstance();
      const data = await sdk.getReviewAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.autoFetch !== false) {
      fetchAnalytics();
    }

    // Set up refresh interval if specified
    if (options?.refreshInterval) {
      const interval = setInterval(fetchAnalytics, options.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [options?.autoFetch, options?.refreshInterval, fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};