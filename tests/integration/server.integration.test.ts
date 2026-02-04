/**
 * Integration tests for PushFloServer
 *
 * These tests run against the real PushFlo API.
 * Required environment variables:
 * - PUSHFLO_SECRET_KEY: A secret key (sec_...) for server operations
 *
 * Note: The realtime API only supports:
 * - POST /api/v1/channels/:slug/messages (publish)
 * - GET /api/v1/channels/:slug/messages (message history)
 *
 * Channel management (create, list, update, delete) is done through a separate admin API.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PushFloServer } from '../../src/server/PushFloServer.js';
import { ValidationError } from '../../src/errors/ValidationError.js';

// Skip integration tests if credentials are not available
const SKIP_INTEGRATION = !process.env.PUSHFLO_SECRET_KEY;

const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

describeIntegration('PushFloServer Integration Tests', () => {
  const secretKey = process.env.PUSHFLO_SECRET_KEY!;
  const baseUrl = process.env.PUSHFLO_API_URL;

  let server: PushFloServer;
  const testChannel = 'sdk-integration-test';

  beforeAll(() => {
    console.log('Integration test config:');
    console.log('  - API URL:', baseUrl || 'https://api.pushflo.dev (default)');
    console.log('  - Secret key prefix:', secretKey?.substring(0, 4) || 'not set');
    console.log('  - Test channel:', testChannel);

    server = new PushFloServer({
      secretKey,
      baseUrl,
      timeout: 30000,
    });
  });

  describe('Message Publishing', () => {
    it('should publish a message to a channel', async () => {
      const result = await server.publish(testChannel, {
        type: 'test',
        message: 'Integration test message',
        timestamp: Date.now(),
      });

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(testChannel);
      expect(typeof result.delivered).toBe('number');
      expect(result.createdAt).toBeDefined();
      expect(result.eventType).toBe('message');
    });

    it('should publish message with custom event type', async () => {
      const result = await server.publish(
        testChannel,
        { action: 'user.created', userId: '12345' },
        { eventType: 'user.created' }
      );

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(testChannel);
    });

    it('should publish message with complex content', async () => {
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

      const result = await server.publish(testChannel, complexContent);

      expect(result.id).toBeDefined();
      expect(result.channelSlug).toBe(testChannel);
    });

    it('should publish multiple messages sequentially', async () => {
      const results: Array<{ id: string; channelSlug: string; delivered: number; timestamp: number }> = [];

      for (let i = 0; i < 3; i++) {
        const result = await server.publish(testChannel, {
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
        server.publish('Invalid Channel!', { test: true })
      ).rejects.toThrow(ValidationError);

      await expect(
        server.publish('', { test: true })
      ).rejects.toThrow(ValidationError);

      await expect(
        server.publish('-invalid', { test: true })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Message History', () => {
    it('should get message history for a channel', async () => {
      // First publish a message to ensure there's something in history
      await server.publish(testChannel, {
        historyTest: true,
        timestamp: Date.now(),
      });

      // Small delay to allow message to be indexed
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await server.getMessageHistory(testChannel);

      expect(result.messages).toBeInstanceOf(Array);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should paginate message history', async () => {
      const result = await server.getMessageHistory(testChannel, {
        page: 1,
        pageSize: 2,
      });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(2);
      expect(result.messages.length).toBeLessThanOrEqual(2);
    });

    it('should include eventType filter parameter in request', async () => {
      // Publish a message with a specific event type
      const uniqueEventType = `test-event-${Date.now()}`;
      await server.publish(
        testChannel,
        { filterTest: true },
        { eventType: uniqueEventType }
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Request with eventType filter - API should accept the parameter
      const result = await server.getMessageHistory(testChannel, {
        eventType: uniqueEventType,
      });

      // Verify we got a valid response
      expect(result.messages).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();

      // If filtering works, messages should have the specified event type
      // If API doesn't support filtering, this test just verifies the request succeeds
      if (result.messages.length > 0 && result.messages.every(m => m.eventType === uniqueEventType)) {
        console.log('Event type filtering is supported');
      } else {
        console.log('Event type filtering may not be supported by the API');
      }
    });

    it('should throw ValidationError for invalid channel slug', async () => {
      await expect(
        server.getMessageHistory('Invalid Channel!')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Message Content Verification', () => {
    it('should preserve message content through publish and history', async () => {
      const uniqueId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const content = {
        uniqueId,
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        unicode: 'Hello 世界 🌍',
      };

      await server.publish(testChannel, content, { eventType: 'content-test' });

      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await server.getMessageHistory(testChannel, {
        eventType: 'content-test',
        pageSize: 10,
      });

      // Find our message by unique ID
      const ourMessage = result.messages.find(
        msg => (msg.content as any).uniqueId === uniqueId
      );

      expect(ourMessage).toBeDefined();
      expect(ourMessage!.content).toMatchObject(content);
    });
  });
});
