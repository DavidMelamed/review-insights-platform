export class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestsPerMinute: number;
  private minInterval: number;

  constructor(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
    this.minInterval = 60000 / requestsPerMinute; // milliseconds between requests
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minInterval - timeSinceLastRequest)
        );
      }

      const resolve = this.queue.shift();
      if (resolve) {
        this.lastRequestTime = Date.now();
        resolve();
      }
    }

    this.processing = false;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}