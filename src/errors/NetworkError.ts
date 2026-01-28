import { PushFloError } from './PushFloError.js';
import { ERROR_CODES } from '../utils/constants.js';

/**
 * Error thrown for network-related failures
 */
export class NetworkError extends PushFloError {
  /** HTTP status code, if applicable */
  readonly statusCode?: number;

  constructor(
    message: string,
    code: string = ERROR_CODES.NETWORK_ERROR,
    options: { retryable?: boolean; cause?: Error; statusCode?: number } = {}
  ) {
    super(message, code, { retryable: true, ...options });
    this.name = 'NetworkError';
    this.statusCode = options.statusCode;
  }

  /**
   * Create a network error from fetch failure
   */
  static fromFetch(cause: Error): NetworkError {
    return new NetworkError(
      `Network request failed: ${cause.message}`,
      ERROR_CODES.NETWORK_ERROR,
      { retryable: true, cause }
    );
  }

  /**
   * Create a request timeout error
   */
  static timeout(timeoutMs: number): NetworkError {
    return new NetworkError(
      `Request timed out after ${timeoutMs}ms`,
      ERROR_CODES.REQUEST_TIMEOUT,
      { retryable: true }
    );
  }

  /**
   * Create an error from HTTP status code
   */
  static fromStatus(statusCode: number, message?: string): NetworkError {
    const defaultMessage = NetworkError.getStatusMessage(statusCode);

    // Determine if retryable based on status
    const retryable = statusCode >= 500 || statusCode === 429;

    // Map status to error code
    let code: string = ERROR_CODES.SERVER_ERROR;
    if (statusCode === 404) {
      code = ERROR_CODES.NOT_FOUND;
    } else if (statusCode === 422 || statusCode === 400) {
      code = ERROR_CODES.VALIDATION_ERROR;
    } else if (statusCode === 429) {
      code = ERROR_CODES.RATE_LIMITED;
    }

    return new NetworkError(
      message ?? defaultMessage,
      code,
      { retryable, statusCode }
    );
  }

  private static getStatusMessage(statusCode: number): string {
    const messages: Record<number, string> = {
      400: 'Bad request',
      404: 'Resource not found',
      422: 'Validation error',
      429: 'Rate limit exceeded',
      500: 'Internal server error',
      502: 'Bad gateway',
      503: 'Service unavailable',
      504: 'Gateway timeout',
    };
    return messages[statusCode] ?? `HTTP error ${statusCode}`;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
    };
  }
}
