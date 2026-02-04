/**
 * Integration tests for PushFloServer
 *
 * These tests run against the real PushFlo API.
 * Required environment variables:
 * - PUSHFLO_SECRET_KEY: A secret key (sec_...) for server operations
 * - PUSHFLO_MGMT_KEY: A management key (mgmt_...) for channel management
 * - PUSHFLO_API_URL: (optional) API base URL, defaults to https://api.pushflo.dev
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PushFloServer } from '../../src/server/PushFloServer.js';
import { AuthenticationError } from '../../src/errors/AuthenticationError.js';
import { ValidationError } from '../../src/errors/ValidationError.js';
import { NetworkError } from '../../src/errors/NetworkError.js';

// Skip integration tests if credentials are not available
const SKIP_INTEGRATION = !process.env.PUSHFLO_SECRET_KEY || !process.env.PUSHFLO_MGMT_KEY;

const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

describeIntegration('PushFloServer Integration Tests', () => {
  const secretKey = process.env.PUSHFLO_SECRET_KEY!;
  const mgmtKey = process.env.PUSHFLO_MGMT_KEY!;
  const baseUrl = process.env.PUSHFLO_API_URL;

  let server: PushFloServer;
  let mgmtServer: PushFloServer;
  const testChannelSlug = `integration-test-${Date.now()}`;
  let createdChannelSlug: string | null = null;

  beforeAll(() => {
    console.log('Integration test config:');
    console.log('  - API URL:', baseUrl || 'https://api.pushflo.dev (default)');
    console.log('  - Secret key prefix:', secretKey?.substring(0, 4) || 'not set');
    console.log('  - Mgmt key prefix:', mgmtKey?.substring(0, 5) || 'not set');

    server = new PushFloServer({
      secretKey,
      baseUrl,
      timeout: 30000,
      debug: true,
    });

    mgmtServer = new PushFloServer({
      secretKey: mgmtKey,
      baseUrl,
      timeout: 30000,
      debug: true,
    });
  });

  afterAll(async () => {
    // Cleanup: delete test channel if it was created
    if (createdChannelSlug) {
      try {
        await mgmtServer.deleteChannel(createdChannelSlug);
        console.log(`Cleaned up test channel: ${createdChannelSlug}`);
      } catch (error) {
        console.warn(`Failed to cleanup test channel: ${createdChannelSlug}`, error);
      }
    }
  });

  describe('Authentication', () => {
    it('should authenticate with valid secret key', async () => {
      const result = await server.listChannels({ pageSize: 1 });
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('pagination');
    });

    it('should authenticate with valid management key', async () => {
      const result = await mgmtServer.listChannels({ pageSize: 1 });
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('pagination');
    });

    it('should reject invalid API key', async () => {
      const invalidServer = new PushFloServer({
        secretKey: 'sec_invalid_key_12345',
        baseUrl,
      });

      await expect(invalidServer.listChannels()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Channel Management', () => {
    it('should list channels with pagination', async () => {
      const result = await mgmtServer.listChannels({ page: 1, pageSize: 5 });

      expect(result.channels).toBeInstanceOf(Array);
      expect(result.pagination).toMatchObject({
        page: 1,
        pageSize: 5,
      });
      expect(typeof result.pagination.total).toBe('number');
      expect(typeof result.pagination.totalPages).toBe('number');
    });

    it('should create a new channel', async () => {
      const channel = await mgmtServer.createChannel({
        name: 'Integration Test Channel',
        slug: testChannelSlug,
        description: 'Created by integration tests',
        isPrivate: false,
        metadata: {
          test: true,
          createdAt: new Date().toISOString(),
        },
      });

      createdChannelSlug = channel.slug;

      expect(channel).toMatchObject({
        name: 'Integration Test Channel',
        slug: testChannelSlug,
        description: 'Created by integration tests',
        isPrivate: false,
      });
      expect(channel.id).toBeDefined();
      expect(channel.createdAt).toBeDefined();
      expect(channel.metadata).toMatchObject({ test: true });
    });

    it('should get channel by slug', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const channel = await mgmtServer.getChannel(createdChannelSlug);

      expect(channel.slug).toBe(createdChannelSlug);
      expect(channel.name).toBe('Integration Test Channel');
    });

    it('should update channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const updated = await mgmtServer.updateChannel(createdChannelSlug, {
        name: 'Updated Integration Test Channel',
        description: 'Updated description',
        metadata: { updated: true },
      });

      expect(updated.name).toBe('Updated Integration Test Channel');
      expect(updated.description).toBe('Updated description');
      expect(updated.metadata).toMatchObject({ updated: true });
    });

    it('should throw NetworkError when getting non-existent channel', async () => {
      await expect(
        mgmtServer.getChannel('nonexistent-channel-slug-12345')
      ).rejects.toThrow(NetworkError);
    });

    it('should throw ValidationError for invalid channel slug', async () => {
      await expect(
        mgmtServer.createChannel({
          name: 'Invalid',
          slug: 'Invalid Slug With Spaces!',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Message Publishing', () => {
    it('should publish a message to a channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const result = await server.publish(createdChannelSlug, {
        type: 'test',
        message: 'Integration test message',
        timestamp: Date.now(),
      });

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(createdChannelSlug);
      expect(typeof result.delivered).toBe('number');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should publish message with custom event type', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const result = await server.publish(
        createdChannelSlug,
        { action: 'user.created', userId: '12345' },
        { eventType: 'user.created' }
      );

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(createdChannelSlug);
    });

    it('should publish multiple messages sequentially', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const results: Array<{ id: string; channelSlug: string; delivered: number; timestamp: number }> = [];
      for (let i = 0; i < 3; i++) {
        const result = await server.publish(createdChannelSlug, {
          sequence: i,
          message: `Message ${i}`,
        });
        results.push(result);
      }

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.id).toBeDefined();
        if (i > 0) {
          expect(result.id).not.toBe(results[i - 1]!.id);
        }
      });
    });
  });

  describe('Message History', () => {
    it('should get message history for a channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      // Allow some time for messages to be indexed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await server.getMessageHistory(createdChannelSlug);

      expect(result.messages).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();
      // We published at least 4 messages in the previous tests
      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should paginate message history', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const result = await server.getMessageHistory(createdChannelSlug, {
        page: 1,
        pageSize: 2,
      });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(2);
      expect(result.messages.length).toBeLessThanOrEqual(2);
    });

    it('should filter message history by event type', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const result = await server.getMessageHistory(createdChannelSlug, {
        eventType: 'user.created',
      });

      // Should find the message we published with eventType 'user.created'
      expect(result.messages).toBeInstanceOf(Array);
      if (result.messages.length > 0) {
        expect(result.messages.every((m) => m.eventType === 'user.created')).toBe(true);
      }
    });
  });

  describe('Channel Cleanup', () => {
    it('should delete channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      await mgmtServer.deleteChannel(createdChannelSlug);

      // Verify channel is deleted
      await expect(
        mgmtServer.getChannel(createdChannelSlug)
      ).rejects.toThrow(NetworkError);

      // Mark as cleaned up so afterAll doesn't try to delete again
      createdChannelSlug = null;
    });
  });
});

describeIntegration('PushFloServer Error Handling Integration', () => {
  const secretKey = process.env.PUSHFLO_SECRET_KEY!;
  const baseUrl = process.env.PUSHFLO_API_URL;

  let server: PushFloServer;

  beforeAll(() => {
    server = new PushFloServer({
      secretKey,
      baseUrl,
      timeout: 30000,
    });
  });

  it('should handle 404 errors gracefully', async () => {
    try {
      await server.getChannel('definitely-does-not-exist-12345');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).code).toBeDefined();
    }
  });

  it('should validate channel slugs before making API calls', async () => {
    // These should fail validation before any network request
    await expect(server.getChannel('')).rejects.toThrow(ValidationError);
    await expect(server.getChannel('has spaces')).rejects.toThrow(ValidationError);
    await expect(server.getChannel('-starts-with-dash')).rejects.toThrow(ValidationError);
    await expect(server.getChannel('ends-with-dash-')).rejects.toThrow(ValidationError);
    await expect(server.getChannel('UPPERCASE')).rejects.toThrow(ValidationError);
  });
});
