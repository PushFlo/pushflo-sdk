import { DEFAULTS } from '../utils/constants.js';
import { retry, type RetryOptions } from '../utils/retry.js';
import { createLogger, type Logger } from '../utils/logger.js';
import { AuthenticationError } from '../errors/AuthenticationError.js';
import { NetworkError } from '../errors/NetworkError.js';
import type { ApiErrorResponse } from '../types/api.js';

export interface RestClientOptions {
  /** API key (secret or management key) */
  apiKey: string;

  /** Base URL for the API */
  baseUrl?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Number of retry attempts */
  retryAttempts?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * HTTP client for PushFlo REST API
 */
export class RestClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly logger: Logger;

  constructor(options: RestClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULTS.BASE_URL).replace(/\/$/, '');
    this.timeout = options.timeout ?? DEFAULTS.CONNECTION_TIMEOUT;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.logger = createLogger({ debug: options.debug, prefix: '[PushFlo REST]' });
  }

  /**
   * Make an HTTP request to the API
   */
  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | undefined>;
      retryOptions?: Partial<RetryOptions>;
    } = {}
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);

    this.logger.debug(`${method} ${url}`);

    const retryOpts: RetryOptions = {
      maxAttempts: this.retryAttempts,
      isRetryable: (error) => {
        if (error instanceof NetworkError) {
          return error.retryable;
        }
        return false;
      },
      onRetry: (attempt, delay, error) => {
        this.logger.warn(`Request failed, retrying (${attempt}/${this.retryAttempts}) in ${delay}ms`, error);
      },
      ...options.retryOptions,
    };

    return retry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method,
          headers: this.getHeaders(),
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        return await this.handleResponse<T>(response);
      } catch (error) {
        if (error instanceof AuthenticationError || error instanceof NetworkError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          throw NetworkError.timeout(this.timeout);
        }

        if (error instanceof TypeError) {
          throw NetworkError.fromFetch(error);
        }

        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }, retryOpts);
  }

  /**
   * Make a GET request
   */
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  /**
   * Make a POST request
   */
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  /**
   * Make a PATCH request
   */
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  /**
   * Make a DELETE request
   */
  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const fullPath = `${DEFAULTS.API_VERSION}${path}`;
    const url = new URL(fullPath, this.baseUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle authentication errors
    if (response.status === 401) {
      throw AuthenticationError.unauthorized();
    }

    if (response.status === 403) {
      throw AuthenticationError.forbidden();
    }

    // Handle other errors
    if (!response.ok) {
      let errorMessage: string | undefined;

      try {
        const errorBody = (await response.json()) as ApiErrorResponse;
        errorMessage = errorBody.error;
      } catch {
        // Ignore JSON parse errors
      }

      throw NetworkError.fromStatus(response.status, errorMessage);
    }

    // Handle empty responses
    if (response.status === 204) {
      return undefined as T;
    }

    // Parse JSON response
    try {
      return (await response.json()) as T;
    } catch {
      throw new NetworkError('Failed to parse response', 'PARSE_ERROR', { retryable: false });
    }
  }
}
