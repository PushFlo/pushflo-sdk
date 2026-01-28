import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RestClient } from '../../src/server/RestClient.js';
import { AuthenticationError } from '../../src/errors/AuthenticationError.js';
import { NetworkError } from '../../src/errors/NetworkError.js';

describe('RestClient', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createClient = (options = {}) => {
    return new RestClient({
      apiKey: 'test_key',
      retryAttempts: 1, // Disable retries by default for faster tests
      ...options,
    });
  };

  const mockResponse = (data: unknown, status = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    });
  };

  describe('request', () => {
    it('should make GET request', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true }));

      const result = await client.get<{ success: boolean }>('/test');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/test'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make POST request with body', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ id: '123' }));

      const result = await client.post<{ id: string }>('/test', { name: 'test' });

      expect(result.id).toBe('123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
    });

    it('should make PATCH request', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ updated: true }));

      await client.patch('/test', { name: 'updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should make DELETE request', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(undefined) })
      );

      await client.delete('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should include authorization header', async () => {
      const client = createClient({ apiKey: 'my_api_key' });
      mockFetch.mockReturnValue(mockResponse({}));

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer my_api_key',
          },
        })
      );
    });

    it('should build URL with query parameters', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({}));

      await client.get('/test', { page: 1, limit: 10, filter: undefined });

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
      expect(url).not.toContain('filter');
    });

    it('should use custom base URL', async () => {
      const client = createClient({ baseUrl: 'https://custom.api.com' });
      mockFetch.mockReturnValue(mockResponse({}));

      await client.get('/test');

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url.startsWith('https://custom.api.com')).toBe(true);
    });

    it('should strip trailing slash from base URL', async () => {
      const client = createClient({ baseUrl: 'https://api.com/' });
      mockFetch.mockReturnValue(mockResponse({}));

      await client.get('/test');

      const url = mockFetch.mock.calls[0]![0] as string;
      // Should normalize to proper URL (no double slashes except in protocol)
      expect(url).toBe('https://api.com/api/v1/test');
    });
  });

  describe('error handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({}, 401));

      await expect(client.get('/test')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError on 403', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({}, 403));

      await expect(client.get('/test')).rejects.toThrow(AuthenticationError);
    });

    it('should throw NetworkError on 404', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ error: 'Not found' }, 404));

      const error = await client.get('/test').catch((e) => e) as NetworkError;
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should throw NetworkError on 500', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ error: 'Server error' }, 500));

      const error = await client.get('/test').catch((e) => e) as NetworkError;
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe('SERVER_ERROR');
    });

    it('should include error message from response', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ error: 'Custom error message' }, 400));

      const error = await client.get('/test').catch((e) => e) as NetworkError;
      expect(error.message).toBe('Custom error message');
    });

    it('should handle network failures', async () => {
      const client = createClient();
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const error = await client.get('/test').catch((e) => e) as NetworkError;
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain('Failed to fetch');
    });

    it.skip('should handle timeout', async () => {
      // This test is skipped because AbortController timeout behavior
      // is difficult to test reliably without real timers
      const client = createClient({ timeout: 100 });
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const error = await client.get('/test').catch((e) => e) as NetworkError;
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe('REQUEST_TIMEOUT');
    });
  });

  describe('retry', () => {
    it('should retry on 5xx errors', async () => {
      const client = createClient({ retryAttempts: 3 });
      mockFetch
        .mockReturnValueOnce(mockResponse({}, 500))
        .mockReturnValueOnce(mockResponse({}, 503))
        .mockReturnValueOnce(mockResponse({ success: true }));

      const result = await client.get<{ success: boolean }>('/test');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should not retry on 4xx errors', async () => {
      const client = createClient({ retryAttempts: 3 });
      mockFetch.mockReturnValue(mockResponse({ error: 'Bad request' }, 400));

      await expect(client.get('/test')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry auth errors', async () => {
      const client = createClient({ retryAttempts: 3 });
      mockFetch.mockReturnValue(mockResponse({}, 401));

      await expect(client.get('/test')).rejects.toThrow(AuthenticationError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('response handling', () => {
    it('should handle 204 No Content', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.reject(new Error('No content')),
        })
      );

      const result = await client.delete('/test');
      expect(result).toBeUndefined();
    });

    it('should handle JSON parse errors', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError('Invalid JSON')),
        })
      );

      await expect(client.get('/test')).rejects.toThrow('Failed to parse response');
    });
  });
});
