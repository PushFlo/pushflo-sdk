import { PushFloError } from './PushFloError.js';
import { ERROR_CODES } from '../utils/constants.js';

/**
 * Error thrown when connection to PushFlo fails
 */
export class ConnectionError extends PushFloError {
  constructor(
    message: string,
    code: string = ERROR_CODES.CONNECTION_FAILED,
    options: { retryable?: boolean; cause?: Error } = {}
  ) {
    super(message, code, { retryable: true, ...options });
    this.name = 'ConnectionError';
  }

  /**
   * Create a connection timeout error
   */
  static timeout(timeoutMs: number): ConnectionError {
    return new ConnectionError(
      `Connection timed out after ${timeoutMs}ms`,
      ERROR_CODES.CONNECTION_TIMEOUT,
      { retryable: true }
    );
  }

  /**
   * Create a connection closed error
   */
  static closed(reason?: string): ConnectionError {
    return new ConnectionError(
      reason ? `Connection closed: ${reason}` : 'Connection closed unexpectedly',
      ERROR_CODES.CONNECTION_CLOSED,
      { retryable: true }
    );
  }

  /**
   * Create a connection failed error
   */
  static failed(reason?: string, cause?: Error): ConnectionError {
    return new ConnectionError(
      reason ? `Connection failed: ${reason}` : 'Failed to connect',
      ERROR_CODES.CONNECTION_FAILED,
      { retryable: true, cause }
    );
  }
}
