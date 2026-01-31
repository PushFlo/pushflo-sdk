import { PushFloError } from './PushFloError.js';

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends PushFloError {
  /** The field that failed validation */
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', { retryable: false });
    this.name = 'ValidationError';
    this.field = field;
  }

  /**
   * Create an error for an invalid channel slug
   */
  static invalidChannelSlug(slug: string): ValidationError {
    return new ValidationError(
      `Invalid channel slug '${slug}': must be 1-64 characters, lowercase alphanumeric with hyphens, cannot start or end with a hyphen`,
      'slug'
    );
  }

  /**
   * Create an error for a required field
   */
  static required(field: string): ValidationError {
    return new ValidationError(`${field} is required`, field);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
    };
  }
}
