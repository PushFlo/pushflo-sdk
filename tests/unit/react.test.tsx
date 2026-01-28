import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  const { messages, lastMessage, connectionState, clearMessages } = useChannel(channel);
  return (
    <div>
      <span data-testid="message-count">{messages.length}</span>
      <span data-testid="last-message">{lastMessage ? JSON.stringify(lastMessage.content) : 'null'}</span>
      <span data-testid="channel-state">{connectionState}</span>
      <button data-testid="clear" onClick={clearMessages}>Clear</button>
    </div>
  );
}

describe('React Integration', () => {
  let mockWs: { instances: MockWebSocket[]; restore: () => void };

  beforeEach(() => {
    mockWs = installMockWebSocket();
  });

  afterEach(() => {
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
  });

  describe('usePushFlo', () => {
    it('should provide connect and disconnect functions', async () => {
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

    it('should have clear button', async () => {
      render(
        <PushFloProvider publishKey="pub_test" autoConnect={false}>
          <TestUseChannel channel="test-channel" />
        </PushFloProvider>
      );

      const clearButton = screen.getByTestId('clear');
      expect(clearButton).toBeTruthy();

      await act(async () => {
        clearButton.click();
      });

      // Messages should still be empty after clear
      expect(screen.getByTestId('message-count').textContent).toBe('0');
    });
  });
});
