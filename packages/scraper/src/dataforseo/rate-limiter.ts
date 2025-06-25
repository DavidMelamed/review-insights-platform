import PQueue from 'p-queue';

export interface RateLimiterOptions {
  maxConcurrent?: number;
  minTime?: number;
  timeout?: number;
}

export class RateLimiter {
  private queue: PQueue;

  constructor(options: RateLimiterOptions = {}) {
    this.queue = new PQueue({
      concurrency: options.maxConcurrent ?? 2,
      interval: options.minTime ?? 1000,
      intervalCap: options.maxConcurrent ?? 2,
      timeout: options.timeout ?? 30000,
    });
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.add(fn) as Promise<T>;
  }

  get size(): number {
    return this.queue.size;
  }

  get pending(): number {
    return this.queue.pending;
  }

  async onEmpty(): Promise<void> {
    return this.queue.onEmpty();
  }

  async onIdle(): Promise<void> {
    return this.queue.onIdle();
  }

  clear(): void {
    this.queue.clear();
  }

  pause(): void {
    this.queue.pause();
  }

  start(): void {
    this.queue.start();
  }
}