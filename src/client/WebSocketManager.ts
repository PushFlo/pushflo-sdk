import { TypedEventEmitter } from '../utils/EventEmitter.js';
import { DEFAULTS, WS_CLIENT_MESSAGES, WS_SERVER_MESSAGES } from '../utils/constants.js';
import { createLogger, type Logger } from '../utils/logger.js';
import { calculateBackoff } from '../utils/retry.js';
import { ConnectionError } from '../errors/ConnectionError.js';
import { AuthenticationError } from '../errors/AuthenticationError.js';
import { ConnectionStateMachine } from './ConnectionStateMachine.js';
import { Heartbeat } from './Heartbeat.js';
import type { ConnectionInfo, ConnectionState } from '../types/connection.js';
import type { WsClientMessage, WsServerMessage } from '../types/api.js';

export interface WebSocketManagerOptions {
  /** API key for authentication */
  apiKey: string;

  /** Base URL for the API */
  baseUrl?: string;

  /** Connection timeout in milliseconds */
  connectionTimeout?: number;

  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;

  /** Enable automatic reconnection */
  autoReconnect?: boolean;

  /** Maximum reconnection attempts (0 = infinite) */
  maxReconnectAttempts?: number;

  /** Initial reconnection delay in milliseconds */
  reconnectDelay?: number;

  /** Maximum reconnection delay in milliseconds */
  maxReconnectDelay?: number;

  /** Enable debug logging */
  debug?: boolean;
}

interface WebSocketManagerEvents {
  [key: string]: unknown[];
  connected: [ConnectionInfo];
  disconnected: [reason?: string];
  message: [WsServerMessage];
  error: [Error];
}

/**
 * Manages WebSocket connection to PushFlo
 */
export class WebSocketManager extends TypedEventEmitter<WebSocketManagerEvents> {
  private readonly options: Required<Omit<WebSocketManagerOptions, 'debug'>>;
  private readonly logger: Logger;
  private readonly stateMachine: ConnectionStateMachine;
  private readonly heartbeat: Heartbeat;

  private ws: WebSocket | null = null;
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private clientId: string | null = null;

  constructor(options: WebSocketManagerOptions) {
    super();

    this.options = {
      apiKey: options.apiKey,
      baseUrl: (options.baseUrl ?? DEFAULTS.BASE_URL).replace(/\/$/, ''),
      connectionTimeout: options.connectionTimeout ?? DEFAULTS.CONNECTION_TIMEOUT,
      heartbeatInterval: options.heartbeatInterval ?? DEFAULTS.HEARTBEAT_INTERVAL,
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? DEFAULTS.MAX_RECONNECT_ATTEMPTS,
      reconnectDelay: options.reconnectDelay ?? DEFAULTS.RECONNECT_DELAY,
      maxReconnectDelay: options.maxReconnectDelay ?? DEFAULTS.MAX_RECONNECT_DELAY,
    };

    this.logger = createLogger({ debug: options.debug, prefix: '[PushFlo WS]' });
    this.stateMachine = new ConnectionStateMachine();
    this.heartbeat = new Heartbeat({
      interval: this.options.heartbeatInterval,
      onPing: () => this.sendPing(),
      onTimeout: () => this.handleHeartbeatTimeout(),
    });
  }

  /**
   * Get current connection state
   */
  get state() {
    return this.stateMachine.state;
  }

  /**
   * Get client ID (available after connected)
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: ConnectionState) => void): () => void {
    return this.stateMachine.onChange(listener);
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<ConnectionInfo> {
    if (this.stateMachine.isConnected) {
      throw new ConnectionError(
        'Already connected',
        'ALREADY_CONNECTED',
        { retryable: false }
      );
    }

    if (this.stateMachine.isConnecting) {
      throw new ConnectionError(
        'Connection in progress',
        'CONNECTION_IN_PROGRESS',
        { retryable: false }
      );
    }

    this.intentionalDisconnect = false;
    this.clearReconnectTimeout();

    return this.establishConnection();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.cleanup();
    this.stateMachine.transition('disconnected');
    this.emit('disconnected', 'Disconnected by client');
  }

  /**
   * Send a message to the server
   */
  send(message: WsClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.logger.debug('Sent message:', message);
      return true;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      return false;
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string): boolean {
    return this.send({
      type: WS_CLIENT_MESSAGES.SUBSCRIBE,
      channel,
    });
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): boolean {
    return this.send({
      type: WS_CLIENT_MESSAGES.UNSUBSCRIBE,
      channel,
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.intentionalDisconnect = true;
    this.cleanup();
    this.removeAllListeners();
    this.stateMachine.removeAllListeners();
  }

  private async establishConnection(): Promise<ConnectionInfo> {
    this.stateMachine.transition('connecting');
    this.logger.debug('Connecting...');

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.buildWsUrl();
        this.logger.debug('WebSocket URL:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        // Set connection timeout
        this.connectionTimeoutId = setTimeout(() => {
          if (this.stateMachine.isConnecting) {
            const error = ConnectionError.timeout(this.options.connectionTimeout);
            this.cleanup();
            this.stateMachine.transition('error');
            this.emit('error', error);
            reject(error);
          }
        }, this.options.connectionTimeout);

        this.ws.onopen = () => {
          this.logger.debug('WebSocket opened, waiting for connected message...');
        };

        this.ws.onclose = (event) => {
          this.handleClose(event, reject);
        };

        this.ws.onerror = (event) => {
          this.logger.error('WebSocket error:', event);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event, resolve, reject);
        };
      } catch (error) {
        this.cleanup();
        this.stateMachine.transition('error');
        const connError = ConnectionError.failed(
          error instanceof Error ? error.message : 'Unknown error',
          error instanceof Error ? error : undefined
        );
        this.emit('error', connError);
        reject(connError);
      }
    });
  }

  private buildWsUrl(): string {
    const baseUrl = this.options.baseUrl;
    const protocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const host = baseUrl.replace(/^https?:\/\//, '');
    return `${protocol}://${host}${DEFAULTS.WS_PATH}?token=${encodeURIComponent(this.options.apiKey)}`;
  }

  private handleMessage(
    event: MessageEvent,
    onConnect?: (info: ConnectionInfo) => void,
    onConnectError?: (error: Error) => void
  ): void {
    try {
      const message = JSON.parse(event.data as string) as WsServerMessage;
      this.logger.debug('Received message:', message);

      switch (message.type) {
        case WS_SERVER_MESSAGES.CONNECTED:
          this.handleConnected(message, onConnect);
          break;

        case WS_SERVER_MESSAGES.PONG:
          this.heartbeat.receivedPong();
          break;

        case WS_SERVER_MESSAGES.ERROR:
          this.handleErrorMessage(message, onConnectError);
          break;

        default:
          // Forward other messages
          this.emit('message', message);
      }
    } catch (error) {
      this.logger.error('Failed to parse message:', error);
    }
  }

  private handleConnected(
    message: WsServerMessage,
    onConnect?: (info: ConnectionInfo) => void
  ): void {
    this.clearConnectionTimeout();

    if (message.clientId) {
      this.clientId = message.clientId;
    }

    const connectionInfo: ConnectionInfo = {
      clientId: message.clientId ?? '',
      timestamp: message.timestamp ?? Date.now(),
    };

    this.reconnectAttempt = 0;
    this.stateMachine.transition('connected');
    this.heartbeat.start();

    this.logger.debug('Connected:', connectionInfo);
    this.emit('connected', connectionInfo);
    onConnect?.(connectionInfo);
  }

  private handleErrorMessage(
    message: WsServerMessage,
    onConnectError?: (error: Error) => void
  ): void {
    const errorMsg = message.error ?? 'Unknown error';
    const code = message.code;

    let error: Error;
    if (code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN') {
      error = AuthenticationError.unauthorized(errorMsg);
    } else {
      error = new ConnectionError(errorMsg, code ?? 'UNKNOWN');
    }

    this.emit('error', error);

    // If still connecting, reject the promise
    if (this.stateMachine.isConnecting) {
      this.cleanup();
      this.stateMachine.transition('error');
      onConnectError?.(error);
    }
  }

  private handleClose(
    event: CloseEvent,
    onConnectError?: (error: Error) => void
  ): void {
    this.logger.debug('WebSocket closed:', event.code, event.reason);

    const wasConnected = this.stateMachine.isConnected;
    this.cleanup();

    if (this.intentionalDisconnect) {
      this.stateMachine.transition('disconnected');
      return;
    }

    // If we were connecting, reject with error
    if (this.stateMachine.isConnecting) {
      this.stateMachine.transition('error');
      const error = ConnectionError.failed(event.reason || 'Connection closed');
      this.emit('error', error);
      onConnectError?.(error);
      return;
    }

    // Handle unexpected disconnect
    this.stateMachine.transition('disconnected');
    this.emit('disconnected', event.reason || undefined);

    // Try to reconnect if enabled
    if (wasConnected && this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private handleHeartbeatTimeout(): void {
    this.logger.warn('Heartbeat timeout, reconnecting...');
    this.cleanup();
    this.stateMachine.transition('disconnected');
    this.emit('disconnected', 'Heartbeat timeout');

    if (this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) {
      return;
    }

    const { maxReconnectAttempts } = this.options;
    if (maxReconnectAttempts > 0 && this.reconnectAttempt >= maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached');
      this.stateMachine.transition('error');
      this.emit('error', new ConnectionError(
        'Max reconnection attempts exceeded',
        'MAX_RECONNECT_ATTEMPTS',
        { retryable: false }
      ));
      return;
    }

    const delay = calculateBackoff(this.reconnectAttempt, {
      initialDelay: this.options.reconnectDelay,
      maxDelay: this.options.maxReconnectDelay,
    });

    this.logger.debug(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectAttempt++;
      this.establishConnection().catch((error) => {
        this.logger.error('Reconnect failed:', error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private sendPing(): void {
    this.send({ type: WS_CLIENT_MESSAGES.PING });
  }

  private cleanup(): void {
    this.clearConnectionTimeout();
    this.heartbeat.stop();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      this.ws = null;
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutId !== null) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }
}
