export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  options: RetryOptions = {}
): Promise<T> {
  const {
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next attempt
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions & { maxRetries?: number } = {}
): T {
  return (async (...args: Parameters<T>) => {
    return retry(() => fn(...args), options.maxRetries, options);
  }) as T;
}