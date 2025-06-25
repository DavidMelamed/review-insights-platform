export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryError extends Error {
  public readonly lastError: Error;
  public readonly attempts: number;

  constructor(message: string, lastError: Error, attempts: number) {
    super(message);
    this.name = 'RetryError';
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry,
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw new RetryError(
          `Failed after ${attempt + 1} attempts: ${lastError.message}`,
          lastError,
          attempt + 1
        );
      }

      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt),
        maxDelay
      );

      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new RetryError(
    `Failed after ${maxRetries + 1} attempts`,
    lastError!,
    maxRetries + 1
  );
}

export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  // Network errors
  if (error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED') {
    return true;
  }
  
  // HTTP status codes that are retryable
  if (error.status === 429 || // Too Many Requests
      error.status === 502 || // Bad Gateway
      error.status === 503 || // Service Unavailable
      error.status === 504) { // Gateway Timeout
    return true;
  }
  
  return false;
}