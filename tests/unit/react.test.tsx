import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { PushFloProvider, usePushFlo, useChannel } from '../../src/react/index.js';
import { installMockWebSocket, type MockWebSocket } from '../mocks/MockWebSocket.js';

// Test component for usePushFlo
function TestUsePushFlo() {
  const { connectionState, isConnected, connect, disconnect } = usePushFlo();
  return (
    <div>
      <span data-testid="state">{connectionState}</span>
      <span data-testid="connected">{String(isConnected)}</span>
      <button data-testid="connect" onClick={() => connect()}>Connect</button>
      <button data-testid="disconnect" onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}

// Test component for useChannel
function TestUseChannel({ channel }: { channel: string }) {
  const { messages, lastMessage, connectionState, clearMessages, isSubscribed } = useChannel(channel);
  return (
    <div>
      <span data-testid="message-count">{messages.length}</span>
      <span data-testid="last-message">{lastMessage ? JSON.stringify(lastMessage.content) : 'null'}</span>
      <span data-testid="channel-state">{connectionState}</span>
      <span data-testid="is-subscribed">{String(isSubscribed)}</span>
      <button data-testid="clear" onClick={clearMessages}>Clear</button>
    </div>
  );
}

// Test component for useChannel with onMessage callback
function TestUseChannelWithCallback({ channel, onMessage }: { channel: string; onMessage: (msg: unknown) => void }) {
  const { messages, lastMessage } = useChannel(channel, { onMessage });
  return (
    <div>
      <span data-testid="message-count">{messages.length}</span>
      <span data-testid="last-message">{lastMessage ? JSON.stringify(lastMessage.content) : 'null'}</span>
    </div>
  );
}

describe('React Integration', () => {
  let mockWs: { instances: MockWebSocket[]; restore: () => void };

  beforeEach(() => {
    mockWs = installMockWebSocket();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    mockWs.restore();
  });

  describe('PushFloProvider', () => {
    it('should throw when hooks used outside provider', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<TestUsePushFlo />)).toThrow('must be used within a PushFloProvider');
      spy.mockRestore();
    });

    it('should provide connection state', () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUsePushFlo />
        </PushFloProvider>
      );

      expect(screen.getByTestId('state').textContent).toBe('disconnected');
      expect(screen.getByTestId('connected').textContent).toBe('false');
    });

    it('should auto-connect when autoConnect is true', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={true}>
          <TestUsePushFlo />
        </PushFloProvider>
      );

      // Advance timers to let React effects run
      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      // Simulate successful connection
      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('state').textContent).toBe('connected');
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    it('should pass baseUrl to client', async () => {
      const customBaseUrl = 'https://custom.pushflo.dev';

      render(
        <PushFloProvider publishKey="pub_test" baseUrl={customBaseUrl} autoConnect={true}>
          <TestUsePushFlo />
        </PushFloProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      // Verify the WebSocket URL contains the custom base URL
      const ws = mockWs.instances[0]!;
      expect(ws.url).toContain('custom.pushflo.dev');
    });
  });

  describe('usePushFlo', () => {
    it('should provide connect and disconnect functions', () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUsePushFlo />
        </PushFloProvider>
      );

      // Initial state
      expect(screen.getByTestId('state').textContent).toBe('disconnected');

      // Connect button should be present
      expect(screen.getByTestId('connect')).toBeTruthy();
      expect(screen.getByTestId('disconnect')).toBeTruthy();
    });

    it('should connect when connect button is clicked', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUsePushFlo />
        </PushFloProvider>
      );

      // Initial state should be disconnected
      expect(screen.getByTestId('state').textContent).toBe('disconnected');

      // Click connect button
      await act(async () => {
        fireEvent.click(screen.getByTestId('connect'));
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      // State should change to connecting
      expect(screen.getByTestId('state').textContent).toBe('connecting');

      // Simulate successful connection
      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      // State should be connected
      expect(screen.getByTestId('state').textContent).toBe('connected');
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    it('should disconnect when disconnect button is clicked', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUsePushFlo />
        </PushFloProvider>
      );

      // First connect
      await act(async () => {
        fireEvent.click(screen.getByTestId('connect'));
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('state').textContent).toBe('connected');

      // Now disconnect
      await act(async () => {
        fireEvent.click(screen.getByTestId('disconnect'));
        vi.advanceTimersByTime(50); // Give time for close to complete
      });

      expect(screen.getByTestId('state').textContent).toBe('disconnected');
      expect(screen.getByTestId('connected').textContent).toBe('false');
    });
  });

  describe('useChannel', () => {
    it('should initialize with empty messages', () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      expect(screen.getByTestId('message-count').textContent).toBe('0');
      expect(screen.getByTestId('last-message').textContent).toBe('null');
    });

    it('should expose isSubscribed property', () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      // Initially not subscribed (not connected)
      expect(screen.getByTestId('is-subscribed').textContent).toBe('false');
    });

    it('should set isSubscribed to true after subscription is confirmed', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={true}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      // Simulate connection and subscription
      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      // Wait for subscription message to be sent
      const ws = mockWs.instances[0]!;
      const messages = ws.getSentMessages();
      expect(messages.some(m => m.type === 'subscribe' && m.channel === 'test-channel')).toBe(true);

      // Simulate subscription confirmation
      await act(async () => {
        ws.simulateMessage({ type: 'subscribed', channel: 'test-channel' });
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('is-subscribed').textContent).toBe('true');
    });

    it('should have clear button that clears messages', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      const clearButton = screen.getByTestId('clear');
      expect(clearButton).toBeTruthy();

      await act(async () => {
        fireEvent.click(clearButton);
        vi.advanceTimersByTime(10);
      });

      // Messages should still be empty after clear
      expect(screen.getByTestId('message-count').textContent).toBe('0');
    });

    it('should receive messages through useChannel', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={true}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      // Simulate connection
      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      // Verify subscription was sent
      const ws = mockWs.instances[0]!;
      expect(ws.getSentMessages().some(m => m.type === 'subscribe')).toBe(true);

      // Simulate subscription confirmation
      await act(async () => {
        ws.simulateMessage({ type: 'subscribed', channel: 'test-channel' });
        vi.advanceTimersByTime(10);
      });

      // Simulate receiving a message
      await act(async () => {
        ws.simulateMessage({
          type: 'message',
          channel: 'test-channel',
          messageId: 'msg-1',
          eventType: 'notification',
          data: { title: 'Hello World' },
          timestamp: Date.now(),
        });
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('message-count').textContent).toBe('1');
      expect(screen.getByTestId('last-message').textContent).toBe('{"title":"Hello World"}');
    });

    it('should call onMessage callback when message is received', async () => {
      const onMessage = vi.fn();

      render(
        <PushFloProvider publishKey="pub_test" autoConnect={true}>
          <TestUseChannelWithCallback channel="test-channel" onMessage={onMessage} />
        </PushFloProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      // Simulate connection and subscription
      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      const ws = mockWs.instances[0]!;
      expect(ws.getSentMessages().some(m => m.type === 'subscribe')).toBe(true);

      await act(async () => {
        ws.simulateMessage({ type: 'subscribed', channel: 'test-channel' });
        vi.advanceTimersByTime(10);
      });

      // Simulate receiving a message
      await act(async () => {
        ws.simulateMessage({
          type: 'message',
          channel: 'test-channel',
          messageId: 'msg-1',
          eventType: 'notification',
          data: { title: 'Test Message' },
          timestamp: Date.now(),
        });
        vi.advanceTimersByTime(10);
      });

      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          channel: 'test-channel',
          content: { title: 'Test Message' },
        })
      );
    });

    it('should clear messages when clearMessages is called', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={true}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      // Simulate connection and subscription
      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      const ws = mockWs.instances[0]!;
      expect(ws.getSentMessages().some(m => m.type === 'subscribe')).toBe(true);

      await act(async () => {
        ws.simulateMessage({ type: 'subscribed', channel: 'test-channel' });
        vi.advanceTimersByTime(10);
      });

      // Send a message
      await act(async () => {
        ws.simulateMessage({
          type: 'message',
          channel: 'test-channel',
          messageId: 'msg-1',
          eventType: 'test',
          data: { text: 'Hello' },
          timestamp: Date.now(),
        });
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('message-count').textContent).toBe('1');

      // Clear messages
      await act(async () => {
        fireEvent.click(screen.getByTestId('clear'));
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('message-count').textContent).toBe('0');
      expect(screen.getByTestId('last-message').textContent).toBe('null');
    });

    it('should receive multiple messages and maintain order', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={true}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockWs.instances.length).toBeGreaterThan(0);

      await act(async () => {
        const ws = mockWs.instances[0]!;
        ws.simulateOpen();
        ws.simulateMessage({ type: 'connected', clientId: 'test-client-123' });
        vi.advanceTimersByTime(10);
      });

      const ws = mockWs.instances[0]!;
      expect(ws.getSentMessages().some(m => m.type === 'subscribe')).toBe(true);

      await act(async () => {
        ws.simulateMessage({ type: 'subscribed', channel: 'test-channel' });
        vi.advanceTimersByTime(10);
      });

      // Send multiple messages
      await act(async () => {
        ws.simulateMessage({
          type: 'message',
          channel: 'test-channel',
          messageId: 'msg-1',
          data: { order: 1 },
          timestamp: Date.now(),
        });
        ws.simulateMessage({
          type: 'message',
          channel: 'test-channel',
          messageId: 'msg-2',
          data: { order: 2 },
          timestamp: Date.now() + 1,
        });
        ws.simulateMessage({
          type: 'message',
          channel: 'test-channel',
          messageId: 'msg-3',
          data: { order: 3 },
          timestamp: Date.now() + 2,
        });
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('message-count').textContent).toBe('3');
      // Last message should be the most recent
      expect(screen.getByTestId('last-message').textContent).toBe('{"order":3}');
    });
  });
});
