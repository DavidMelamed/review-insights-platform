import { useState, useEffect } from 'react';
import { ReviewInsightsSDK } from '../ReviewInsightsSDK';
import { User } from '../types';

interface UseSDKResult {
  sdk: ReviewInsightsSDK | null;
  isReady: boolean;
  user: User | null;
  error: Error | null;
}

export const useSDK = (): UseSDKResult => {
  const [sdk, setSdk] = useState<ReviewInsightsSDK | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const sdkInstance = ReviewInsightsSDK.getInstance();
      setSdk(sdkInstance);
      setIsReady(sdkInstance.isReady);
      setUser(sdkInstance.user);
    } catch (err) {
      setError(err as Error);
      console.error('SDK not initialized:', err);
    }
  }, []);

  useEffect(() => {
    if (!sdk) return;

    // Poll for SDK readiness
    const checkReady = setInterval(() => {
      if (sdk.isReady) {
        setIsReady(true);
        setUser(sdk.user);
        clearInterval(checkReady);
      }
    }, 100);

    return () => clearInterval(checkReady);
  }, [sdk]);

  return {
    sdk,
    isReady,
    user,
    error,
  };
};