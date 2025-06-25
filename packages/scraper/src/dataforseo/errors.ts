export class DataForSEOError extends Error {
  public readonly code: number;
  public readonly statusCode?: number;
  public readonly details?: any;

  constructor(message: string, code: number, statusCode?: number, details?: any) {
    super(message);
    this.name = 'DataForSEOError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class AuthenticationError extends DataForSEOError {
  constructor(message = 'Authentication failed', details?: any) {
    super(message, 401, 401, details);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends DataForSEOError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number, details?: any) {
    super(message, 429, 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class TaskNotFoundError extends DataForSEOError {
  public readonly taskId: string;

  constructor(taskId: string, message = 'Task not found', details?: any) {
    super(message, 404, 404, details);
    this.name = 'TaskNotFoundError';
    this.taskId = taskId;
  }
}

export class ValidationError extends DataForSEOError {
  public readonly field?: string;

  constructor(message: string, field?: string, details?: any) {
    super(message, 400, 400, details);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class NetworkError extends DataForSEOError {
  constructor(message: string, originalError?: Error) {
    super(message, 0, undefined, originalError);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends DataForSEOError {
  constructor(message = 'Request timeout', timeout?: number) {
    super(message, 0, undefined, { timeout });
    this.name = 'TimeoutError';
  }
}

export function parseDataForSEOError(error: any): DataForSEOError {
  // Handle fetch errors
  if (error.name === 'AbortError') {
    return new TimeoutError('Request was aborted');
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new NetworkError(`Network error: ${error.message}`, error);
  }

  // Handle HTTP errors
  const status = error.status || error.statusCode;
  
  switch (status) {
    case 401:
      return new AuthenticationError(error.message || 'Invalid credentials');
    case 429:
      const retryAfter = error.headers?.['retry-after'];
      return new RateLimitError(
        error.message || 'Too many requests',
        retryAfter ? parseInt(retryAfter) : undefined
      );
    case 404:
      return new TaskNotFoundError(
        error.taskId || 'unknown',
        error.message || 'Resource not found'
      );
    case 400:
      return new ValidationError(
        error.message || 'Invalid request parameters',
        error.field
      );
    default:
      return new DataForSEOError(
        error.message || 'An error occurred',
        status || 0,
        status,
        error
      );
  }
}