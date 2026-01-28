import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager } from '../../src/client/WebSocketManager.js';
import { installMockWebSocket, type MockWebSocket } from '../mocks/MockWebSocket.js';

describe('WebSocketManager', () => {
  let mockWs: { instances: MockWebSocket[]; restore: () => void };

  beforeEach(() => {
    vi.useFakeTimers();
    mockWs = installMockWebSocket();
  });

  afterEach(() => {
    mockWs.restore();
    vi.useRealTimers();
  });

  const createManager = (options = {}) => {
    return new WebSocketManager({
      apiKey: 'pub_test123',
      ...options,
    });
  };

  describe('connect', () => {
    it('should connect successfully', async () => {
      const manager = createManager();
      const connectedHandler = vi.fn();
      manager.on('connected', connectedHandler);

      const connectPromise = manager.connect();

      // Get the WebSocket instance
      expect(mockWs.instances.length).toBe(1);
      const ws = mockWs.instances[0]!;

      // Simulate connection
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'connected',
        clientId: 'client-123',
        timestamp: Date.now(),
      });

      const info = await connectPromise;

      expect(info.clientId).toBe('client-123');
      expect(manager.state).toBe('connected');
      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should build correct WebSocket URL', async () => {
      const manager = createManager({
        apiKey: 'pub_mykey',
        baseUrl: 'https://api.example.com',
      });

      manager.connect();

      const ws = mockWs.instances[0]!;
      expect(ws.url).toBe('wss://api.example.com/ws?token=pub_mykey');
    });

    it('should use ws:// for http:// base URL', async () => {
      const manager = createManager({
        apiKey: 'pub_mykey',
        baseUrl: 'http://localhost:3000',
      });

      manager.connect();

      const ws = mockWs.instances[0]!;
      expect(ws.url).toBe('ws://localhost:3000/ws?token=pub_mykey');
    });

    it('should throw when already connected', async () => {
      const manager = createManager();

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      await expect(manager.connect()).rejects.toThrow('Already connected');
    });

    it('should throw when connection in progress', async () => {
      const manager = createManager();

      manager.connect();

      await expect(manager.connect()).rejects.toThrow('Connection in progress');
    });

    it('should timeout connection', async () => {
      const manager = createManager({ connectionTimeout: 1000 });
      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      const connectPromise = manager.connect();

      // Advance past timeout
      vi.advanceTimersByTime(1001);

      await expect(connectPromise).rejects.toThrow('timed out');
      expect(manager.state).toBe('error');
    });
  });

  describe('disconnect', () => {
    it('should disconnect gracefully', async () => {
      const manager = createManager();
      const disconnectedHandler = vi.fn();
      manager.on('disconnected', disconnectedHandler);

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      manager.disconnect();

      expect(manager.state).toBe('disconnected');
      expect(disconnectedHandler).toHaveBeenCalledWith('Disconnected by client');
    });

    it('should not reconnect after intentional disconnect', async () => {
      const manager = createManager({ autoReconnect: true });

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      manager.disconnect();

      // Advance time to ensure no reconnect
      vi.advanceTimersByTime(10000);

      expect(mockWs.instances.length).toBe(1);
    });
  });

  describe('send', () => {
    it('should send message when connected', async () => {
      const manager = createManager();

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      const sent = manager.send({ type: 'ping' });

      expect(sent).toBe(true);
      expect(ws.getSentMessages()[0]).toEqual({ type: 'ping' });
    });

    it('should return false when not connected', () => {
      const manager = createManager();

      const sent = manager.send({ type: 'ping' });

      expect(sent).toBe(false);
    });

    it('should subscribe to channel', async () => {
      const manager = createManager();

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      manager.subscribe('test-channel');

      expect(ws.getSentMessages()[0]).toEqual({
        type: 'subscribe',
        channel: 'test-channel',
      });
    });

    it('should unsubscribe from channel', async () => {
      const manager = createManager();

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      manager.unsubscribe('test-channel');

      expect(ws.getSentMessages()[0]).toEqual({
        type: 'unsubscribe',
        channel: 'test-channel',
      });
    });
  });

  describe('reconnection', () => {
    it('should reconnect on unexpected close', async () => {
      const manager = createManager({ autoReconnect: true, reconnectDelay: 100 });

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      // Simulate unexpected close
      ws.simulateClose(1006, 'Abnormal closure');

      // Advance past reconnect delay
      vi.advanceTimersByTime(200);

      expect(mockWs.instances.length).toBe(2);
    });

    it('should respect maxReconnectAttempts', async () => {
      const manager = createManager({
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 100,
      });
      const disconnectedHandler = vi.fn();
      manager.on('disconnected', disconnectedHandler);

      const connectPromise = manager.connect();
      const ws1 = mockWs.instances[0]!;
      ws1.simulateOpen();
      ws1.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      // First disconnect - triggers reconnect
      ws1.simulateClose(1006);

      // Wait for first reconnect attempt to start
      await vi.advanceTimersByTimeAsync(200);
      expect(mockWs.instances.length).toBeGreaterThan(1);

      // Disconnected event should have been emitted
      expect(disconnectedHandler).toHaveBeenCalled();
    });
  });

  describe('messages', () => {
    it('should handle pong message', async () => {
      const manager = createManager({ heartbeatInterval: 1000 });

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      // Advance to send ping
      vi.advanceTimersByTime(1000);

      // Simulate pong
      ws.simulateMessage({ type: 'pong' });

      // Should not timeout
      vi.advanceTimersByTime(2000);
      expect(manager.state).toBe('connected');
    });

    it('should emit error on error message', async () => {
      const manager = createManager();
      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      ws.simulateMessage({
        type: 'error',
        error: 'Something went wrong',
        code: 'TEST_ERROR',
      });

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should forward other messages', async () => {
      const manager = createManager();
      const messageHandler = vi.fn();
      manager.on('message', messageHandler);

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      ws.simulateMessage({
        type: 'subscribed',
        channel: 'test-channel',
      });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'subscribed', channel: 'test-channel' })
      );
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', async () => {
      const manager = createManager();

      const connectPromise = manager.connect();
      const ws = mockWs.instances[0]!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'connected', clientId: 'test' });
      await connectPromise;

      manager.destroy();

      expect(manager.listenerCount('connected')).toBe(0);
    });
  });
});
