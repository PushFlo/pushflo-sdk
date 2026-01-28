import { PushFloError } from './PushFloError.js';
import { ERROR_CODES } from '../utils/constants.js';

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends PushFloError {
  constructor(
    message: string,
    code: string = ERROR_CODES.UNAUTHORIZED,
    options: { retryable?: boolean; cause?: Error } = {}
  ) {
    // Authentication errors are generally not retryable
    super(message, code, { retryable: false, ...options });
    this.name = 'AuthenticationError';
  }

  /**
   * Create an invalid API key error
   */
  static invalidKey(keyType?: string): AuthenticationError {
    const message = keyType
      ? `Invalid ${keyType} API key`
      : 'Invalid API key';
    return new AuthenticationError(message, ERROR_CODES.INVALID_API_KEY);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(reason?: string): AuthenticationError {
    return new AuthenticationError(
      reason ?? 'Unauthorized - check your API key',
      ERROR_CODES.UNAUTHORIZED
    );
  }

  /**
   * Create a forbidden error
   */
  static forbidden(action?: string): AuthenticationError {
    const message = action
      ? `Access forbidden: insufficient permissions for ${action}`
      : 'Access forbidden: insufficient permissions';
    return new AuthenticationError(message, ERROR_CODES.FORBIDDEN);
  }
}
