export class Logger {
  private debugMode: boolean;
  private prefix = '[ReviewInsights]';

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  log(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.log(`${this.prefix} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.warn(`${this.prefix} ${message}`, ...args);
    }
  }

  error(message: string, error?: any, ...args: any[]): void {
    console.error(`${this.prefix} ${message}`, error, ...args);
  }

  info(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.info(`${this.prefix} ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.debug(`${this.prefix} ${message}`, ...args);
    }
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}