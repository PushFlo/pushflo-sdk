/**
 * Integration tests for PushFloServer
 *
 * These tests run against the real PushFlo APIs:
 * - Realtime API (api.pushflo.dev): publish, message history
 * - Console API (console.pushflo.dev): channel management
 *
 * Required environment variables:
 * - PUSHFLO_SECRET_KEY: A secret key (sec_...) for Realtime API operations
 * - PUSHFLO_MGMT_KEY: A management key (mgmt_...) for Console API operations
 *
 * Optional environment variables:
 * - PUSHFLO_API_URL: Custom Realtime API URL
 * - PUSHFLO_CONSOLE_URL: Custom Console API URL
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PushFloServer } from '../../src/server/PushFloServer.js';
import { ValidationError } from '../../src/errors/ValidationError.js';
import { NetworkError } from '../../src/errors/NetworkError.js';

// Skip integration tests if credentials are not available
const SKIP_INTEGRATION = !process.env.PUSHFLO_SECRET_KEY || !process.env.PUSHFLO_MGMT_KEY;

const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

describeIntegration('PushFloServer Integration Tests', () => {
  const secretKey = process.env.PUSHFLO_SECRET_KEY!;
  const mgmtKey = process.env.PUSHFLO_MGMT_KEY!;
  const apiUrl = process.env.PUSHFLO_API_URL;
  const consoleUrl = process.env.PUSHFLO_CONSOLE_URL;

  // Server client for Realtime API operations (publish, message history)
  let realtimeServer: PushFloServer;
  // Server client for Console API operations (channel management)
  let consoleServer: PushFloServer;

  const testChannelSlug = `integration-test-${Date.now()}`;
  let createdChannelSlug: string | null = null;

  beforeAll(() => {
    console.log('Integration test config:');
    console.log('  - Realtime API URL:', apiUrl || 'https://api.pushflo.dev (default)');
    console.log('  - Console API URL:', consoleUrl || 'https://console.pushflo.dev (default)');
    console.log('  - Secret key prefix:', secretKey?.substring(0, 4) || 'not set');
    console.log('  - Mgmt key prefix:', mgmtKey?.substring(0, 5) || 'not set');
    console.log('  - Test channel slug:', testChannelSlug);

    // Client for Realtime API (publish, message history)
    realtimeServer = new PushFloServer({
      secretKey,
      baseUrl: apiUrl,
      consoleUrl: consoleUrl,
      timeout: 30000,
    });

    // Client for Console API (channel management)
    consoleServer = new PushFloServer({
      secretKey: mgmtKey,
      baseUrl: apiUrl,
      consoleUrl: consoleUrl,
      timeout: 30000,
    });
  });

  afterAll(async () => {
    // Cleanup: delete test channel if it was created
    if (createdChannelSlug) {
      try {
        await consoleServer.deleteChannel(createdChannelSlug);
        console.log(`Cleaned up test channel: ${createdChannelSlug}`);
      } catch (error) {
        console.warn(`Failed to cleanup test channel: ${createdChannelSlug}`, error);
      }
    }
  });

  // ============================================
  // Console API Tests (Channel Management)
  // ============================================

  describe('Channel Management (Console API)', () => {
    it('should list channels with pagination', async () => {
      const result = await consoleServer.listChannels({ page: 1, pageSize: 5 });

      expect(result.channels).toBeInstanceOf(Array);
      expect(result.pagination).toMatchObject({
        page: 1,
        pageSize: 5,
      });
      expect(typeof result.pagination.total).toBe('number');
      expect(typeof result.pagination.totalPages).toBe('number');
    });

    it('should create a new channel', async () => {
      const channel = await consoleServer.createChannel({
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
    });

    it('should get channel by slug', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const channel = await consoleServer.getChannel(createdChannelSlug);

      expect(channel.slug).toBe(createdChannelSlug);
      expect(channel.name).toBe('Integration Test Channel');
    });

    it('should update channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const updated = await consoleServer.updateChannel(createdChannelSlug, {
        name: 'Updated Integration Test Channel',
        description: 'Updated description',
      });

      expect(updated.name).toBe('Updated Integration Test Channel');
      expect(updated.description).toBe('Updated description');
    });

    it('should throw NetworkError when getting non-existent channel', async () => {
      await expect(
        consoleServer.getChannel('nonexistent-channel-slug-12345')
      ).rejects.toThrow(NetworkError);
    });

    it('should throw ValidationError for invalid channel slug', async () => {
      await expect(
        consoleServer.createChannel({
          name: 'Invalid',
          slug: 'Invalid Slug With Spaces!',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============================================
  // Realtime API Tests (Publish, Message History)
  // ============================================

  describe('Message Publishing (Realtime API)', () => {
    it('should publish a message to a channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const result = await realtimeServer.publish(createdChannelSlug, {
        type: 'test',
        message: 'Integration test message',
        timestamp: Date.now(),
      });

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(createdChannelSlug);
      expect(typeof result.delivered).toBe('number');
      expect(result.createdAt).toBeDefined();
      expect(result.eventType).toBe('message');
    });

    it('should publish message with custom event type', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const result = await realtimeServer.publish(
        createdChannelSlug,
        { action: 'user.created', userId: '12345' },
        { eventType: 'user.created' }
      );

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(createdChannelSlug);
      expect(result.eventType).toBe('user.created');
    });

    it('should publish message with complex content', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const complexContent = {
        user: {
          id: '123',
          name: 'Test User',
          metadata: { role: 'admin' },
        },
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        enabled: true,
        count: 42,
      };

      const result = await realtimeServer.publish(createdChannelSlug, complexContent);

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(createdChannelSlug);
    });

    it('should publish multiple messages sequentially', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const results: Array<{ id: string; channelSlug: string; delivered: number; createdAt: string }> = [];

      for (let i = 0; i < 3; i++) {
        const result = await realtimeServer.publish(createdChannelSlug, {
          sequence: i,
          message: `Sequential message ${i}`,
        });
        results.push(result);
      }

      expect(results).toHaveLength(3);

      // Each message should have a unique ID
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should throw ValidationError for invalid channel slug', async () => {
      await expect(
        realtimeServer.publish('Invalid Channel!', { test: true })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Message History (Realtime API)', () => {
    it('should get message history for a channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      // Small delay to allow messages to be indexed
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await realtimeServer.getMessageHistory(createdChannelSlug);

      expect(result.messages).toBeInstanceOf(Array);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should paginate message history', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const result = await realtimeServer.getMessageHistory(createdChannelSlug, {
        page: 1,
        pageSize: 2,
      });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(2);
      expect(result.messages.length).toBeLessThanOrEqual(2);
    });

    it('should throw ValidationError for invalid channel slug', async () => {
      await expect(
        realtimeServer.getMessageHistory('Invalid Channel!')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Message Content Verification', () => {
    it('should preserve message content through publish and history', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      const uniqueId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const content = {
        uniqueId,
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        unicode: 'Hello 世界 🌍',
      };

      await realtimeServer.publish(createdChannelSlug, content, { eventType: 'content-test' });

      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await realtimeServer.getMessageHistory(createdChannelSlug, {
        pageSize: 10,
      });

      // Find our message by unique ID
      const ourMessage = result.messages.find(
        msg => (msg.content as Record<string, unknown>).uniqueId === uniqueId
      );

      expect(ourMessage).toBeDefined();
      expect(ourMessage!.content).toMatchObject(content);
    });
  });

  // ============================================
  // Channel Cleanup (at the end)
  // ============================================

  describe('Channel Cleanup', () => {
    it('should delete channel', async () => {
      if (!createdChannelSlug) {
        throw new Error('Test channel was not created');
      }

      await consoleServer.deleteChannel(createdChannelSlug);

      // Verify channel is deleted
      await expect(
        consoleServer.getChannel(createdChannelSlug)
      ).rejects.toThrow(NetworkError);

      // Mark as cleaned up so afterAll doesn't try to delete again
      createdChannelSlug = null;
    });
  });
});
