import { DEFAULTS } from './constants.js';

export interface RetryOptions {
  /** Maximum number of retry attempts (0 = infinite) */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Delay multiplier for exponential backoff */
  multiplier?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoff(
  attempt: number,
  options: {
    initialDelay?: number;
    maxDelay?: number;
    multiplier?: number;
  } = {}
): number {
  const {
    initialDelay = DEFAULTS.RECONNECT_DELAY,
    maxDelay = DEFAULTS.MAX_RECONNECT_DELAY,
    multiplier = DEFAULTS.RECONNECT_MULTIPLIER,
  } = options;

  // Exponential backoff
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter (±25%)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for a given duration (cancellable)
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = DEFAULTS.RECONNECT_DELAY,
    maxDelay = DEFAULTS.MAX_RECONNECT_DELAY,
    multiplier = DEFAULTS.RECONNECT_MULTIPLIER,
    isRetryable = () => true,
    onRetry,
    signal,
  } = options;

  let lastError: unknown;
  let attempt = 0;

  while (maxAttempts === 0 || attempt < maxAttempts) {
    try {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry abort errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      // Check if we should retry
      if (!isRetryable(error)) {
        throw error;
      }

      // Check if we've exhausted attempts
      if (maxAttempts !== 0 && attempt >= maxAttempts - 1) {
        throw error;
      }

      // Calculate delay
      const delay = calculateBackoff(attempt, { initialDelay, maxDelay, multiplier });

      // Notify retry callback
      onRetry?.(attempt + 1, delay, error);

      // Wait before next attempt
      await sleep(delay, signal);

      attempt++;
    }
  }

  throw lastError;
}

/**
 * Create a retry function with preset options
 */
export function createRetry(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> => {
    return retry(fn, { ...defaultOptions, ...options });
  };
}
