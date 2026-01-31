import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PushFloServer } from '../../src/server/PushFloServer.js';
import { AuthenticationError } from '../../src/errors/AuthenticationError.js';
import { NetworkError } from '../../src/errors/NetworkError.js';

describe('PushFloServer', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createServer = (options = {}) => {
    return new PushFloServer({
      secretKey: 'sec_test123',
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

  describe('constructor', () => {
    it('should require secretKey', () => {
      expect(() => new PushFloServer({} as any)).toThrow('Secret key is required');
    });

    it('should validate key format', () => {
      expect(() => new PushFloServer({ secretKey: 'pub_invalid' })).toThrow(AuthenticationError);
    });

    it('should accept sec_ keys', () => {
      expect(() => createServer({ secretKey: 'sec_valid' })).not.toThrow();
    });

    it('should accept mgmt_ keys', () => {
      expect(() => createServer({ secretKey: 'mgmt_valid' })).not.toThrow();
    });
  });

  describe('listChannels', () => {
    it('should list channels', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          channels: [
            { id: '1', name: 'Test', slug: 'test' },
          ],
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        })
      );

      const result = await server.listChannels();

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0]!.slug).toBe('test');
      expect(result.pagination.total).toBe(1);
    });

    it('should pass pagination options', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          channels: [],
          pagination: { page: 2, pageSize: 10, total: 20, totalPages: 2 },
        })
      );

      await server.listChannels({ page: 2, pageSize: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pageSize=10'),
        expect.any(Object)
      );
    });
  });

  describe('getChannel', () => {
    it('should get channel by slug', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          id: '1',
          name: 'Test Channel',
          slug: 'test-channel',
        })
      );

      const channel = await server.getChannel('test-channel');

      expect(channel.slug).toBe('test-channel');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/channels/test-channel'),
        expect.any(Object)
      );
    });

    it('should throw on 404', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({ error: 'Channel not found' }, 404)
      );

      await expect(server.getChannel('nonexistent')).rejects.toThrow(NetworkError);
    });
  });

  describe('createChannel', () => {
    it('should create channel', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          id: '1',
          name: 'New Channel',
          slug: 'new-channel',
        })
      );

      const channel = await server.createChannel({
        name: 'New Channel',
        slug: 'new-channel',
      });

      expect(channel.name).toBe('New Channel');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/channels'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'New Channel',
            slug: 'new-channel',
          }),
        })
      );
    });
  });

  describe('updateChannel', () => {
    it('should update channel', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          id: '1',
          name: 'Updated Name',
          slug: 'test-channel',
        })
      );

      const channel = await server.updateChannel('test-channel', {
        name: 'Updated Name',
      });

      expect(channel.name).toBe('Updated Name');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/channels/test-channel'),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('deleteChannel', () => {
    it('should delete channel', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve(undefined),
        })
      );

      await server.deleteChannel('test-channel');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/channels/test-channel'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('publish', () => {
    it('should publish message', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          id: 'msg-1',
          channel: 'test-channel',
          delivered: 5,
          timestamp: Date.now(),
        })
      );

      const result = await server.publish('test-channel', { text: 'hello' });

      expect(result.id).toBe('msg-1');
      expect(result.delivered).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/channels/test-channel/messages'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            content: { text: 'hello' },
            eventType: 'message',
          }),
        })
      );
    });

    it('should publish with custom event type', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          id: 'msg-1',
          channel: 'test-channel',
          delivered: 1,
          timestamp: Date.now(),
        })
      );

      await server.publish(
        'test-channel',
        { orderId: '123' },
        { eventType: 'order.created' }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            content: { orderId: '123' },
            eventType: 'order.created',
          }),
        })
      );
    });
  });

  describe('getMessageHistory', () => {
    it('should get message history', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          items: [
            {
              id: 'msg-1',
              channel: 'test-channel',
              eventType: 'message',
              clientId: 'client-1',
              content: { text: 'hello' },
              timestamp: Date.now(),
            },
          ],
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        })
      );

      const result = await server.getMessageHistory('test-channel');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.content).toEqual({ text: 'hello' });
    });

    it('should pass filter options', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(
        mockResponse({
          items: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
        })
      );

      await server.getMessageHistory('test-channel', {
        eventType: 'order.created',
        after: 1000,
        before: 2000,
      });

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('eventType=order.created');
      expect(url).toContain('after=1000');
      expect(url).toContain('before=2000');
    });
  });

  describe('authentication', () => {
    it('should include Authorization header', async () => {
      const server = createServer({ secretKey: 'sec_mykey' });
      mockFetch.mockReturnValue(mockResponse({ channels: [], pagination: {} }));

      await server.listChannels();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer sec_mykey',
          },
        })
      );
    });

    it('should handle 401 errors', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(mockResponse({}, 401));

      await expect(server.listChannels()).rejects.toThrow(AuthenticationError);
    });

    it('should handle 403 errors', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(mockResponse({}, 403));

      await expect(server.listChannels()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('retry', () => {
    it('should retry on 5xx errors', async () => {
      const server = createServer({ retryAttempts: 2 });
      mockFetch
        .mockReturnValueOnce(mockResponse({}, 500))
        .mockReturnValueOnce(mockResponse({ channels: [], pagination: {} }));

      const result = await server.listChannels();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.channels).toEqual([]);
    });

    it('should not retry on 4xx errors', async () => {
      const server = createServer({ retryAttempts: 2 });
      mockFetch.mockReturnValue(mockResponse({ error: 'Bad request' }, 400));

      await expect(server.listChannels()).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
