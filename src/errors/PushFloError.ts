/**
 * Base error class for all PushFlo SDK errors
 */
export class PushFloError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;

  /** Whether this error is potentially recoverable through retry */
  readonly retryable: boolean;

  /** Original error that caused this error, if any */
  readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    options: { retryable?: boolean; cause?: Error } = {}
  ) {
    super(message);
    this.name = 'PushFloError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }

  /**
   * Create a string representation
   */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}
