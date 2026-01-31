/**
 * Channel slug validation utilities
 *
 * Channel slugs must follow these rules:
 * - 1-64 characters long
 * - Lowercase letters (a-z), numbers (0-9), and hyphens (-) only
 * - Cannot start or end with a hyphen
 * - Cannot have consecutive hyphens
 */

/** Maximum length for a channel slug */
export const MAX_SLUG_LENGTH = 64;

/** Minimum length for a channel slug */
export const MIN_SLUG_LENGTH = 1;

/**
 * Regular expression for validating channel slugs
 * Matches: lowercase alphanumeric, can contain hyphens but not at start/end
 */
const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Check if a channel slug is valid
 *
 * @param slug - The channel slug to validate
 * @returns true if the slug is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidChannelSlug('my-channel')     // true
 * isValidChannelSlug('channel-123')    // true
 * isValidChannelSlug('a')              // true
 * isValidChannelSlug('My-Channel')     // false (uppercase)
 * isValidChannelSlug('-channel')       // false (starts with hyphen)
 * isValidChannelSlug('channel:name')   // false (contains colon)
 * isValidChannelSlug('channel_name')   // false (contains underscore)
 * ```
 */
export function isValidChannelSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }

  // Check for consecutive hyphens
  if (slug.includes('--')) {
    return false;
  }

  return SLUG_REGEX.test(slug);
}

/**
 * Convert a string to a valid channel slug
 *
 * @param str - The string to convert
 * @returns A valid channel slug
 *
 * @example
 * ```typescript
 * toChannelSlug('My Channel')           // 'my-channel'
 * toChannelSlug('Hello World!')         // 'hello-world'
 * toChannelSlug('user:123:messages')    // 'user-123-messages'
 * toChannelSlug('___test___')           // 'test'
 * ```
 */
export function toChannelSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .replace(/-{2,}/g, '-')        // Replace consecutive hyphens with single
    .slice(0, MAX_SLUG_LENGTH);    // Truncate to max length
}

/**
 * Validation result with detailed error information
 */
export interface SlugValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validate a channel slug with detailed error messages
 *
 * @param slug - The channel slug to validate
 * @returns Validation result with error details and suggestions
 */
export function validateChannelSlug(slug: string): SlugValidationResult {
  if (!slug || typeof slug !== 'string') {
    return {
      valid: false,
      error: 'Channel slug is required',
    };
  }

  if (slug.length < MIN_SLUG_LENGTH) {
    return {
      valid: false,
      error: 'Channel slug cannot be empty',
    };
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    return {
      valid: false,
      error: `Channel slug cannot exceed ${MAX_SLUG_LENGTH} characters (got ${slug.length})`,
      suggestion: toChannelSlug(slug),
    };
  }

  if (slug !== slug.toLowerCase()) {
    return {
      valid: false,
      error: 'Channel slug must be lowercase',
      suggestion: toChannelSlug(slug),
    };
  }

  if (slug.startsWith('-')) {
    return {
      valid: false,
      error: 'Channel slug cannot start with a hyphen',
      suggestion: toChannelSlug(slug),
    };
  }

  if (slug.endsWith('-')) {
    return {
      valid: false,
      error: 'Channel slug cannot end with a hyphen',
      suggestion: toChannelSlug(slug),
    };
  }

  if (slug.includes('--')) {
    return {
      valid: false,
      error: 'Channel slug cannot contain consecutive hyphens',
      suggestion: toChannelSlug(slug),
    };
  }

  const invalidChars = slug.match(/[^a-z0-9-]/g);
  if (invalidChars) {
    const uniqueChars = [...new Set(invalidChars)].join(', ');
    return {
      valid: false,
      error: `Channel slug contains invalid characters: ${uniqueChars}. Only lowercase letters, numbers, and hyphens are allowed.`,
      suggestion: toChannelSlug(slug),
    };
  }

  return { valid: true };
}
