import { vi } from 'vitest';

export interface MockWebSocketMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Mock WebSocket for testing
 */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly url: string;
  readyState: number = MockWebSocket.CONNECTING;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  sentMessages: string[] = [];

  // Track close parameters for verification if needed
  lastCloseCode?: number;
  lastCloseReason?: string;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Simulate connection opened
   */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  /**
   * Simulate receiving a message
   */
  simulateMessage(data: MockWebSocketMessage | string): void {
    const messageData = typeof data === 'string' ? data : JSON.stringify(data);
    const event = new MessageEvent('message', { data: messageData });
    this.onmessage?.(event);
  }

  /**
   * Simulate connection closed
   */
  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent('close', { code, reason, wasClean: code === 1000 });
    this.onclose?.(event);
  }

  /**
   * Simulate error
   */
  simulateError(): void {
    const event = new Event('error');
    this.onerror?.(event);
  }

  /**
   * Send a message (captured for testing)
   */
  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  /**
   * Close the connection
   */
  close(code?: number, reason?: string): void {
    this.lastCloseCode = code;
    this.lastCloseReason = reason;
    this.readyState = MockWebSocket.CLOSING;
    // In real WebSocket, close event fires asynchronously
    setTimeout(() => {
      this.simulateClose(code ?? 1000, reason ?? '');
    }, 0);
  }

  /**
   * Get parsed sent messages
   */
  getSentMessages(): MockWebSocketMessage[] {
    return this.sentMessages.map((msg) => JSON.parse(msg) as MockWebSocketMessage);
  }

  /**
   * Clear sent messages
   */
  clearSentMessages(): void {
    this.sentMessages = [];
  }
}

/**
 * Install MockWebSocket as global WebSocket
 */
export function installMockWebSocket(): {
  instances: MockWebSocket[];
  restore: () => void;
} {
  const instances: MockWebSocket[] = [];
  const originalWebSocket = globalThis.WebSocket;

  // Create a mock constructor that tracks instances
  const MockWebSocketConstructor = vi.fn(function (this: MockWebSocket, url: string) {
    const instance = new MockWebSocket(url);
    instances.push(instance);
    return instance;
  }) as unknown as typeof WebSocket;

  // Add static properties - must be enumerable and configurable for proper access
  Object.defineProperty(MockWebSocketConstructor, 'CONNECTING', { value: 0, enumerable: true });
  Object.defineProperty(MockWebSocketConstructor, 'OPEN', { value: 1, enumerable: true });
  Object.defineProperty(MockWebSocketConstructor, 'CLOSING', { value: 2, enumerable: true });
  Object.defineProperty(MockWebSocketConstructor, 'CLOSED', { value: 3, enumerable: true });

  globalThis.WebSocket = MockWebSocketConstructor;

  return {
    instances,
    restore: () => {
      globalThis.WebSocket = originalWebSocket;
    },
  };
}
