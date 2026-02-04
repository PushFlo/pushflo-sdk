import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RestClient } from '../../src/server/RestClient.js';
import { AuthenticationError } from '../../src/errors/AuthenticationError.js';
import { NetworkError } from '../../src/errors/NetworkError.js';

describe('RestClient Comprehensive Tests', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const createClient = (options = {}) => {
    return new RestClient({
      apiKey: 'sec_test123',
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

  describe('Response Unwrapping', () => {
    it('should unwrap {success, data} response format', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        mockResponse({
          success: true,
          data: { id: '123', name: 'Test' },
        })
      );

      const result = await client.get<{ id: string; name: string }>('/test');

      expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('should unwrap {success, data, pagination} response format', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        mockResponse({
          success: true,
          data: [{ id: '1' }, { id: '2' }],
          pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
        })
      );

      const result = await client.get<{ data: unknown[]; pagination: unknown }>('/test');

      expect(result).toEqual({
        data: [{ id: '1' }, { id: '2' }],
        pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
      });
    });

    it('should return raw response when no success/data wrapper', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        mockResponse({ id: '123', name: 'Test' })
      );

      const result = await client.get<{ id: string; name: string }>('/test');

      expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('should handle empty data array in paginated response', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        mockResponse({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
        })
      );

      const result = await client.get<{ data: unknown[]; pagination: unknown }>('/test');

      expect(result.data).toEqual([]);
      expect(result.pagination).toEqual({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    });
  });

  describe('URL Building', () => {
    it('should build URL with base URL and API version', async () => {
      const client = createClient({ baseUrl: 'https://api.example.com' });
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.get('/channels');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/channels',
        expect.any(Object)
      );
    });

    it('should strip trailing slash from base URL', async () => {
      const client = createClient({ baseUrl: 'https://api.example.com/' });
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.get('/channels');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/channels',
        expect.any(Object)
      );
    });

    it('should include query parameters', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: [] }));

      await client.get('/channels', { page: 2, pageSize: 10 });

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=10');
    });

    it('should skip undefined query parameters', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: [] }));

      await client.get('/channels', { page: undefined, pageSize: 10 });

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).not.toContain('page=');
      expect(url).toContain('pageSize=10');
    });

    it('should encode special characters in path', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.get('/channels/test%20channel');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/channels/test%20channel'),
        expect.any(Object)
      );
    });
  });

  describe('Headers', () => {
    it('should include Authorization header with Bearer token', async () => {
      const client = createClient({ apiKey: 'sec_myapikey' });
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sec_myapikey',
          }),
        })
      );
    });

    it('should include Content-Type header', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('HTTP Methods', () => {
    it('should make GET request', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make POST request with body', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.post('/test', { name: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
    });

    it('should make PATCH request with body', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.patch('/test', { name: 'updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'updated' }),
        })
      );
    });

    it('should make DELETE request', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve(undefined),
        })
      );

      await client.delete('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({}, 401));

      await expect(client.get('/test')).rejects.toThrow(AuthenticationError);
      await expect(client.get('/test')).rejects.toThrow(/unauthorized/i);
    });

    it('should throw AuthenticationError on 403', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({}, 403));

      await expect(client.get('/test')).rejects.toThrow(AuthenticationError);
      await expect(client.get('/test')).rejects.toThrow(/forbidden/i);
    });

    it('should throw NetworkError on 404 with error message', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ error: 'Channel not found' }, 404));

      try {
        await client.get('/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).message).toContain('Channel not found');
      }
    });

    it('should throw NetworkError on 500', async () => {
      const client = createClient({ retryAttempts: 1 });
      mockFetch.mockReturnValue(mockResponse({}, 500));

      await expect(client.get('/test')).rejects.toThrow(NetworkError);
    });

    it('should throw NetworkError on network failure', async () => {
      const client = createClient({ retryAttempts: 1 });
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      await expect(client.get('/test')).rejects.toThrow(NetworkError);
    });

    it('should throw NetworkError on JSON parse failure', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new Error('Invalid JSON')),
        })
      );

      await expect(client.get('/test')).rejects.toThrow(NetworkError);
      await expect(client.get('/test')).rejects.toThrow(/parse/i);
    });

    it('should handle 204 No Content response', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve(undefined),
        })
      );

      const result = await client.delete<void>('/test');

      expect(result).toBeUndefined();
    });
  });

  describe('Timeout', () => {
    it('should timeout after configured duration', async () => {
      const client = createClient({ timeout: 5000, retryAttempts: 1 });

      mockFetch.mockImplementation((_url, options) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ success: true, data: {} }),
            });
          }, 10000);

          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }
        });
      });

      const promise = client.get('/test');
      await vi.advanceTimersByTimeAsync(5001);

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).message).toMatch(/timed? ?out/i);
      }
    });
  });

  describe('Request Body Handling', () => {
    it('should serialize complex objects', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      const complexBody = {
        name: 'test',
        metadata: { nested: { value: 123 } },
        tags: ['a', 'b', 'c'],
      };

      await client.post('/test', complexBody);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(complexBody),
        })
      );
    });

    it('should not include body for POST without data', async () => {
      const client = createClient();
      mockFetch.mockReturnValue(mockResponse({ success: true, data: {} }));

      await client.post('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: undefined,
        })
      );
    });
  });
});
