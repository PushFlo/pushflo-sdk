import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PushFloServer } from '../../src/server/PushFloServer.js';
import { AuthenticationError } from '../../src/errors/AuthenticationError.js';
import { ValidationError } from '../../src/errors/ValidationError.js';
import { NetworkError } from '../../src/errors/NetworkError.js';

describe('PushFloServer Comprehensive Tests', () => {
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

  describe('Constructor Validation', () => {
    it('should throw when secretKey is missing', () => {
      expect(() => new PushFloServer({} as any)).toThrow('Secret key is required');
      expect(() => new PushFloServer({} as any)).toThrow(AuthenticationError);
    });

    it('should throw when secretKey is empty', () => {
      expect(() => new PushFloServer({ secretKey: '' })).toThrow('Secret key is required');
    });

    it('should throw for invalid key prefix', () => {
      expect(() => new PushFloServer({ secretKey: 'pub_invalid' })).toThrow(AuthenticationError);
      expect(() => new PushFloServer({ secretKey: 'invalid_key' })).toThrow(AuthenticationError);
      expect(() => new PushFloServer({ secretKey: 'sk_test' })).toThrow(AuthenticationError);
    });

    it('should accept sec_ prefixed keys', () => {
      expect(() => createServer({ secretKey: 'sec_validkey123' })).not.toThrow();
    });

    it('should accept mgmt_ prefixed keys', () => {
      expect(() => createServer({ secretKey: 'mgmt_validkey123' })).not.toThrow();
    });

    it('should accept custom baseUrl', () => {
      const server = createServer({ baseUrl: 'https://custom.api.com' });
      expect(server).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const server = createServer({ timeout: 60000 });
      expect(server).toBeDefined();
    });

    it('should accept custom retryAttempts', () => {
      const server = createServer({ retryAttempts: 5 });
      expect(server).toBeDefined();
    });
  });

  describe('Channel Management', () => {
    describe('listChannels', () => {
      it('should return channels and pagination', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [
              {
                id: '1',
                name: 'General',
                slug: 'general',
                description: 'General chat',
                isPrivate: false,
                metadata: null,
                messageCount: 100,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              {
                id: '2',
                name: 'Private',
                slug: 'private',
                description: null,
                isPrivate: true,
                metadata: { team: 'engineering' },
                messageCount: 50,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
              },
            ],
            pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
          })
        );

        const result = await server.listChannels();

        expect(result.channels).toHaveLength(2);
        expect(result.channels[0]).toMatchObject({
          id: '1',
          name: 'General',
          slug: 'general',
        });
        expect(result.channels[1]).toMatchObject({
          id: '2',
          name: 'Private',
          slug: 'private',
          isPrivate: true,
        });
        expect(result.pagination).toEqual({
          page: 1,
          pageSize: 25,
          total: 2,
          totalPages: 1,
        });
      });

      it('should handle empty channel list', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [],
            pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
          })
        );

        const result = await server.listChannels();

        expect(result.channels).toHaveLength(0);
        expect(result.pagination.total).toBe(0);
      });

      it('should pass pagination options to API', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [],
            pagination: { page: 3, pageSize: 50, total: 100, totalPages: 2 },
          })
        );

        await server.listChannels({ page: 3, pageSize: 50 });

        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('page=3');
        expect(url).toContain('pageSize=50');
      });

      it('should use default page size when not specified', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [],
            pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
          })
        );

        await server.listChannels();

        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('pageSize=25');
      });
    });

    describe('getChannel', () => {
      it('should get channel by slug', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: '1',
              name: 'Test Channel',
              slug: 'test-channel',
              description: 'A test channel',
              isPrivate: false,
              metadata: { key: 'value' },
              messageCount: 42,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
            },
          })
        );

        const channel = await server.getChannel('test-channel');

        expect(channel).toMatchObject({
          id: '1',
          name: 'Test Channel',
          slug: 'test-channel',
          messageCount: 42,
        });
      });

      it('should throw ValidationError for invalid slug', async () => {
        const server = createServer();

        await expect(server.getChannel('Invalid Slug!')).rejects.toThrow(ValidationError);
        await expect(server.getChannel('')).rejects.toThrow(ValidationError);
        await expect(server.getChannel('-invalid')).rejects.toThrow(ValidationError);
        await expect(server.getChannel('invalid-')).rejects.toThrow(ValidationError);
      });

      it('should throw NetworkError on 404', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(mockResponse({ error: 'Channel not found' }, 404));

        await expect(server.getChannel('nonexistent')).rejects.toThrow(NetworkError);
      });
    });

    describe('createChannel', () => {
      it('should create channel with minimal input', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: '1',
              name: 'New Channel',
              slug: 'new-channel',
              description: null,
              isPrivate: false,
              metadata: null,
              messageCount: 0,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          })
        );

        const channel = await server.createChannel({
          name: 'New Channel',
          slug: 'new-channel',
        });

        expect(channel.name).toBe('New Channel');
        expect(channel.slug).toBe('new-channel');
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

      it('should create channel with all options', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: '1',
              name: 'Private Channel',
              slug: 'private-channel',
              description: 'A private channel',
              isPrivate: true,
              metadata: { team: 'engineering' },
              messageCount: 0,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          })
        );

        const channel = await server.createChannel({
          name: 'Private Channel',
          slug: 'private-channel',
          description: 'A private channel',
          isPrivate: true,
          metadata: { team: 'engineering' },
        });

        expect(channel.isPrivate).toBe(true);
        expect(channel.metadata).toEqual({ team: 'engineering' });
      });

      it('should throw ValidationError for invalid slug', async () => {
        const server = createServer();

        await expect(
          server.createChannel({ name: 'Test', slug: 'Invalid Slug!' })
        ).rejects.toThrow(ValidationError);
      });

      it('should throw NetworkError on conflict', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(mockResponse({ error: 'Channel already exists' }, 409));

        await expect(
          server.createChannel({ name: 'Test', slug: 'existing' })
        ).rejects.toThrow(NetworkError);
      });
    });

    describe('updateChannel', () => {
      it('should update channel name', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: '1',
              name: 'Updated Name',
              slug: 'test-channel',
              description: null,
              isPrivate: false,
              metadata: null,
              messageCount: 10,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
            },
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
            body: JSON.stringify({ name: 'Updated Name' }),
          })
        );
      });

      it('should update channel description', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: '1',
              name: 'Channel',
              slug: 'test-channel',
              description: 'New description',
              isPrivate: false,
              metadata: null,
              messageCount: 10,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
            },
          })
        );

        const channel = await server.updateChannel('test-channel', {
          description: 'New description',
        });

        expect(channel.description).toBe('New description');
      });

      it('should clear channel description with null', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: '1',
              name: 'Channel',
              slug: 'test-channel',
              description: null,
              isPrivate: false,
              metadata: null,
              messageCount: 10,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
            },
          })
        );

        await server.updateChannel('test-channel', { description: null });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ description: null }),
          })
        );
      });

      it('should update channel metadata', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: '1',
              name: 'Channel',
              slug: 'test-channel',
              description: null,
              isPrivate: false,
              metadata: { priority: 'high' },
              messageCount: 10,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
            },
          })
        );

        const channel = await server.updateChannel('test-channel', {
          metadata: { priority: 'high' },
        });

        expect(channel.metadata).toEqual({ priority: 'high' });
      });

      it('should throw ValidationError for invalid slug', async () => {
        const server = createServer();

        await expect(
          server.updateChannel('Invalid Slug!', { name: 'Test' })
        ).rejects.toThrow(ValidationError);
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
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      it('should throw ValidationError for invalid slug', async () => {
        const server = createServer();

        await expect(server.deleteChannel('Invalid Slug!')).rejects.toThrow(ValidationError);
      });

      it('should throw NetworkError on 404', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(mockResponse({ error: 'Channel not found' }, 404));

        await expect(server.deleteChannel('nonexistent')).rejects.toThrow(NetworkError);
      });
    });
  });

  describe('Message Publishing', () => {
    describe('publish', () => {
      it('should publish message with default event type', async () => {
        const server = createServer();
        const now = Date.now();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: 'msg-123',
              channelSlug: 'test-channel',
              delivered: 5,
              timestamp: now,
            },
          })
        );

        const result = await server.publish('test-channel', { text: 'Hello!' });

        expect(result).toMatchObject({
          id: 'msg-123',
          channelSlug: 'test-channel',
          delivered: 5,
        });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/channels/test-channel/messages'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              content: { text: 'Hello!' },
              eventType: 'message',
            }),
          })
        );
      });

      it('should publish message with custom event type', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: 'msg-123',
              channelSlug: 'orders',
              delivered: 10,
              timestamp: Date.now(),
            },
          })
        );

        await server.publish(
          'orders',
          { orderId: '12345', status: 'completed' },
          { eventType: 'order.completed' }
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              content: { orderId: '12345', status: 'completed' },
              eventType: 'order.completed',
            }),
          })
        );
      });

      it('should publish message with complex content', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: 'msg-123',
              channelSlug: 'test-channel',
              delivered: 1,
              timestamp: Date.now(),
            },
          })
        );

        const complexContent = {
          user: {
            id: '123',
            name: 'John',
            preferences: { theme: 'dark' },
          },
          items: [{ id: 1 }, { id: 2 }],
          count: 42,
          enabled: true,
        };

        await server.publish('test-channel', complexContent);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              content: complexContent,
              eventType: 'message',
            }),
          })
        );
      });

      it('should throw ValidationError for invalid channel slug', async () => {
        const server = createServer();

        await expect(
          server.publish('Invalid Slug!', { text: 'test' })
        ).rejects.toThrow(ValidationError);
      });

      it('should return delivered count of 0 when no subscribers', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: {
              id: 'msg-123',
              channelSlug: 'empty-channel',
              delivered: 0,
              timestamp: Date.now(),
            },
          })
        );

        const result = await server.publish('empty-channel', { text: 'test' });

        expect(result.delivered).toBe(0);
      });
    });
  });

  describe('Message History', () => {
    describe('getMessageHistory', () => {
      it('should get message history', async () => {
        const server = createServer();
        const now = Date.now();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [
              {
                id: 'msg-1',
                channel: 'test-channel',
                eventType: 'message',
                clientId: 'client-123',
                content: { text: 'Hello' },
                timestamp: now - 1000,
              },
              {
                id: 'msg-2',
                channel: 'test-channel',
                eventType: 'message',
                clientId: 'client-456',
                content: { text: 'World' },
                timestamp: now,
              },
            ],
            pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
          })
        );

        const result = await server.getMessageHistory('test-channel');

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0]).toMatchObject({
          id: 'msg-1',
          content: { text: 'Hello' },
        });
        expect(result.pagination.total).toBe(2);
      });

      it('should filter by event type', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [],
            pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
          })
        );

        await server.getMessageHistory('test-channel', {
          eventType: 'order.created',
        });

        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('eventType=order.created');
      });

      it('should filter by timestamp range', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [],
            pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
          })
        );

        await server.getMessageHistory('test-channel', {
          after: 1000000,
          before: 2000000,
        });

        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('after=1000000');
        expect(url).toContain('before=2000000');
      });

      it('should handle pagination', async () => {
        const server = createServer();
        mockFetch.mockReturnValue(
          mockResponse({
            success: true,
            data: [],
            pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3 },
          })
        );

        await server.getMessageHistory('test-channel', {
          page: 2,
          pageSize: 10,
        });

        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('page=2');
        expect(url).toContain('pageSize=10');
      });

      it('should throw ValidationError for invalid channel slug', async () => {
        const server = createServer();

        await expect(
          server.getMessageHistory('Invalid Slug!')
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should throw AuthenticationError on 401', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(mockResponse({}, 401));

      await expect(server.listChannels()).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError on 403', async () => {
      const server = createServer();
      mockFetch.mockReturnValue(mockResponse({}, 403));

      await expect(server.listChannels()).rejects.toThrow(AuthenticationError);
    });

    it('should throw NetworkError on 429 rate limit', async () => {
      const server = createServer({ retryAttempts: 1 });
      mockFetch.mockReturnValue(mockResponse({ error: 'Rate limit exceeded' }, 429));

      await expect(server.listChannels()).rejects.toThrow(NetworkError);
    });

    it('should throw NetworkError on 500 server error', async () => {
      const server = createServer({ retryAttempts: 1 });
      mockFetch.mockReturnValue(mockResponse({ error: 'Internal server error' }, 500));

      await expect(server.listChannels()).rejects.toThrow(NetworkError);
    });
  });
});
