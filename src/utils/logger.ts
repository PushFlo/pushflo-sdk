export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom log prefix */
  prefix?: string;
  /** Minimum log level */
  level?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Simple logger with debug mode support
 */
export class Logger {
  private enabled: boolean;
  private prefix: string;
  private minLevel: number;

  constructor(options: LoggerOptions = {}) {
    this.enabled = options.debug ?? false;
    this.prefix = options.prefix ?? '[PushFlo]';
    this.minLevel = LOG_LEVELS[options.level ?? 'debug'];
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = LOG_LEVELS[level];
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.enabled && level !== 'error') {
      return;
    }

    if (LOG_LEVELS[level] < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `${this.prefix} ${timestamp} [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        break;
    }
  }
}

/**
 * Create a child logger with a custom prefix
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}
