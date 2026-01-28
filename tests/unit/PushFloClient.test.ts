import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PushFloClient } from '../../src/client/PushFloClient.js';
import { AuthenticationError } from '../../src/errors/AuthenticationError.js';
import { installMockWebSocket, type MockWebSocket } from '../mocks/MockWebSocket.js';

describe('PushFloClient', () => {
  let mockWs: { instances: MockWebSocket[]; restore: () => void };

  beforeEach(() => {
    vi.useFakeTimers();
    mockWs = installMockWebSocket();
  });

  afterEach(() => {
    mockWs.restore();
    vi.useRealTimers();
  });

  const createClient = (options = {}) => {
    return new PushFloClient({
      publishKey: 'pub_test123',
      ...options,
    });
  };

  describe('constructor', () => {
    it('should require publishKey', () => {
      expect(() => new PushFloClient({} as any)).toThrow('Publish key is required');
    });

    it('should validate key format', () => {
      expect(() => new PushFloClient({ publishKey: 'invalid' })).toThrow(AuthenticationError);
    });

    it('should accept pub_ keys', () => {
      expect(() => createClient({ publishKey: 'pub_valid' })).not.toThrow();
    });

    it('should accept sec_ keys', () => {
      expect(() => createClient({ publishKey: 'sec_valid' })).not.toThrow();
    });

    it('should accept mgmt_ keys', () => {
      expect(() => createClient({ publishKey: 'mgmt_valid' })).not.toThrow();
    });
  });

  describe('connect', () => {
    it('should connect to WebSocket', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'client-123' });

      await connectPromise;

      expect(client.connectionState).toBe('connected');
      expect(client.clientId).toBe('client-123');
    });

    it('should emit connected event', async () => {
      const client = createClient();
      const connectedHandler = vi.fn();
      client.on('connected', connectedHandler);

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });

      await connectPromise;

      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should auto-connect when enabled', async () => {
      createClient({ autoConnect: true });

      // Should have started connecting
      expect(mockWs.instances.length).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from WebSocket', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      client.disconnect();

      expect(client.connectionState).toBe('disconnected');
    });

    it('should emit disconnected event', async () => {
      const client = createClient();
      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      client.disconnect();

      expect(disconnectedHandler).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to channel', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      const subscription = client.subscribe('test-channel');

      expect(subscription.channel).toBe('test-channel');
      expect(client.isSubscribed('test-channel')).toBe(true);
    });

    it('should require channel name', () => {
      const client = createClient();

      expect(() => client.subscribe('')).toThrow('Channel is required');
    });

    it('should send subscribe message when connected', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;
      ws.clearSentMessages();

      client.subscribe('test-channel');

      expect(ws.getSentMessages()[0]).toEqual({
        type: 'subscribe',
        channel: 'test-channel',
      });
    });

    it('should queue subscription when not connected', () => {
      const client = createClient();

      const subscription = client.subscribe('test-channel');

      expect(subscription.channel).toBe('test-channel');
      expect(client.isSubscribed('test-channel')).toBe(true);
      expect(mockWs.instances.length).toBe(0); // Not connected yet
    });

    it('should call onMessage handler', async () => {
      const client = createClient();
      const onMessage = vi.fn();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      client.subscribe('test-channel', { onMessage });

      // Simulate subscription confirmation
      ws.simulateMessage({ type: 'subscribed', channel: 'test-channel' });

      // Simulate incoming message
      ws.simulateMessage({
        type: 'message',
        channel: 'test-channel',
        message: {
          id: 'msg-1',
          eventType: 'message',
          clientId: 'other-client',
          content: { text: 'hello' },
          timestamp: Date.now(),
        },
      });

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          channel: 'test-channel',
          content: { text: 'hello' },
        })
      );
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from channel', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      client.subscribe('test-channel');
      client.unsubscribe('test-channel');

      expect(client.isSubscribed('test-channel')).toBe(false);
    });

    it('should send unsubscribe message when connected', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      client.subscribe('test-channel');
      ws.clearSentMessages();

      client.unsubscribe('test-channel');

      expect(ws.getSentMessages()[0]).toEqual({
        type: 'unsubscribe',
        channel: 'test-channel',
      });
    });

    it('should use subscription.unsubscribe()', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      const subscription = client.subscribe('test-channel');
      subscription.unsubscribe();

      expect(client.isSubscribed('test-channel')).toBe(false);
    });
  });

  describe('onConnectionChange', () => {
    it('should notify on connection state changes', async () => {
      const client = createClient();
      const listener = vi.fn();
      client.onConnectionChange(listener);

      const connectPromise = client.connect();
      expect(listener).toHaveBeenCalledWith('connecting');

      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      expect(listener).toHaveBeenCalledWith('connected');
    });

    it('should allow unsubscribing', async () => {
      const client = createClient();
      const listener = vi.fn();
      const unsubscribe = client.onConnectionChange(listener);

      unsubscribe();

      client.connect();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getSubscribedChannels', () => {
    it('should return list of subscribed channels', () => {
      const client = createClient();

      client.subscribe('channel-1');
      client.subscribe('channel-2');

      const channels = client.getSubscribedChannels();

      expect(channels).toContain('channel-1');
      expect(channels).toContain('channel-2');
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', async () => {
      const client = createClient();
      const listener = vi.fn();
      client.onConnectionChange(listener);

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      client.subscribe('test-channel');
      client.destroy();

      expect(client.getSubscribedChannels()).toEqual([]);
    });
  });

  describe('re-subscription on reconnect', () => {
    it('should re-subscribe to channels on reconnect', async () => {
      const client = createClient();

      const connectPromise = client.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      client.subscribe('test-channel');
      ws.clearSentMessages();

      // Disconnect
      client.disconnect();

      // Reconnect
      const reconnectPromise = client.connect();
      const ws2 = mockWs.instances[1]!;
      ws2.simulateOpen();
      ws2.simulateMessage({ type: 'connected', clientId: 'test2' });
      await reconnectPromise;

      // Should have re-subscribed
      expect(ws2.getSentMessages()).toContainEqual({
        type: 'subscribe',
        channel: 'test-channel',
      });
    });
  });
});
