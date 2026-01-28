import { TypedEventEmitter } from '../utils/EventEmitter.js';
import { DEFAULTS, WS_SERVER_MESSAGES, ERROR_CODES } from '../utils/constants.js';
import { createLogger, type Logger } from '../utils/logger.js';
import { AuthenticationError } from '../errors/AuthenticationError.js';
import { PushFloError } from '../errors/PushFloError.js';
import { WebSocketManager } from './WebSocketManager.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import type { ConnectionState, ClientOptions, ConnectionInfo } from '../types/connection.js';
import type { Message, Subscription, SubscriptionOptions } from '../types/message.js';
import type { WsServerMessage } from '../types/api.js';

interface PushFloClientEvents {
  [key: string]: unknown[];
  connected: [ConnectionInfo];
  disconnected: [reason?: string];
  message: [Message];
  error: [Error];
}

/**
 * Browser client for PushFlo real-time messaging
 */
export class PushFloClient extends TypedEventEmitter<PushFloClientEvents> {
  private readonly wsManager: WebSocketManager;
  private readonly subscriptions: SubscriptionManager;
  private readonly logger: Logger;
  private connectionChangeListeners: Set<(state: ConnectionState) => void> = new Set();

  constructor(options: ClientOptions) {
    super();

    if (!options.publishKey) {
      throw new AuthenticationError(
        'Publish key is required',
        'MISSING_PUBLISH_KEY'
      );
    }

    if (!options.publishKey.startsWith('pub_') &&
        !options.publishKey.startsWith('sec_') &&
        !options.publishKey.startsWith('mgmt_')) {
      throw AuthenticationError.invalidKey('publish');
    }

    this.logger = createLogger({ debug: options.debug, prefix: '[PushFlo]' });
    this.subscriptions = new SubscriptionManager();

    this.wsManager = new WebSocketManager({
      apiKey: options.publishKey,
      baseUrl: options.baseUrl ?? DEFAULTS.BASE_URL,
      connectionTimeout: options.connectionTimeout,
      heartbeatInterval: options.heartbeatInterval,
      autoReconnect: options.autoReconnect,
      maxReconnectAttempts: options.maxReconnectAttempts,
      reconnectDelay: options.reconnectDelay,
      maxReconnectDelay: options.maxReconnectDelay,
      debug: options.debug,
    });

    this.setupEventHandlers();

    // Auto-connect if enabled
    if (options.autoConnect) {
      this.connect().catch((error) => {
        this.logger.error('Auto-connect failed:', error);
      });
    }
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.wsManager.state;
  }

  /**
   * Get client ID (available after connected)
   */
  get clientId(): string | null {
    return this.wsManager.getClientId();
  }

  /**
   * Connect to PushFlo
   */
  async connect(): Promise<void> {
    this.logger.debug('Connecting...');
    await this.wsManager.connect();

    // Re-subscribe to all channels
    const channels = this.subscriptions.getChannels();
    if (channels.length > 0) {
      this.logger.debug('Re-subscribing to channels:', channels);
      this.subscriptions.resetConfirmations();
      channels.forEach((channel) => {
        this.wsManager.subscribe(channel);
      });
    }
  }

  /**
   * Disconnect from PushFlo
   */
  disconnect(): void {
    this.logger.debug('Disconnecting...');
    this.wsManager.disconnect();
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.logger.debug('Destroying client...');
    this.subscriptions.clear();
    this.wsManager.destroy();
    this.connectionChangeListeners.clear();
    this.removeAllListeners();
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, options: SubscriptionOptions = {}): Subscription {
    if (!channel) {
      throw new PushFloError('Channel is required', 'INVALID_CHANNEL', { retryable: false });
    }

    this.logger.debug('Subscribing to channel:', channel);

    // Add to subscription manager
    this.subscriptions.add(channel, options);

    // Send subscribe message if connected
    if (this.wsManager.state === 'connected') {
      this.wsManager.subscribe(channel);
    }

    // Return subscription handle
    return {
      channel,
      unsubscribe: () => this.unsubscribe(channel),
    };
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): void {
    this.logger.debug('Unsubscribing from channel:', channel);

    // Remove from subscription manager
    this.subscriptions.remove(channel);

    // Send unsubscribe message if connected
    if (this.wsManager.state === 'connected') {
      this.wsManager.unsubscribe(channel);
    }
  }

  /**
   * Register a connection state change listener
   */
  onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionChangeListeners.add(listener);
    return () => this.connectionChangeListeners.delete(listener);
  }

  /**
   * Get list of subscribed channels
   */
  getSubscribedChannels(): string[] {
    return this.subscriptions.getChannels();
  }

  /**
   * Check if subscribed to a channel
   */
  isSubscribed(channel: string): boolean {
    return this.subscriptions.has(channel);
  }

  private setupEventHandlers(): void {
    // Handle connection state changes
    this.wsManager.onStateChange((state) => {
      this.connectionChangeListeners.forEach((listener) => {
        try {
          listener(state);
        } catch (error) {
          this.logger.error('Error in connection change listener:', error);
        }
      });
    });

    // Handle connected
    this.wsManager.on('connected', (info) => {
      this.emit('connected', info);
    });

    // Handle disconnected
    this.wsManager.on('disconnected', (reason) => {
      this.emit('disconnected', reason);
    });

    // Handle errors
    this.wsManager.on('error', (error) => {
      this.emit('error', error);
    });

    // Handle messages
    this.wsManager.on('message', (message) => {
      this.handleServerMessage(message);
    });
  }

  private handleServerMessage(message: WsServerMessage): void {
    switch (message.type) {
      case WS_SERVER_MESSAGES.SUBSCRIBED:
        if (message.channel) {
          this.subscriptions.confirm(message.channel);
          this.logger.debug('Subscribed to channel:', message.channel);
        }
        break;

      case WS_SERVER_MESSAGES.UNSUBSCRIBED:
        if (message.channel) {
          this.logger.debug('Unsubscribed from channel:', message.channel);
        }
        break;

      case WS_SERVER_MESSAGES.MESSAGE:
        if (message.channel && message.message) {
          const fullMessage: Message = {
            id: message.message.id,
            channel: message.channel,
            eventType: message.message.eventType,
            clientId: message.message.clientId,
            content: message.message.content,
            timestamp: message.message.timestamp,
          };

          // Notify subscription handler
          this.subscriptions.handleMessage(fullMessage);

          // Emit general message event
          this.emit('message', fullMessage);
        }
        break;

      case WS_SERVER_MESSAGES.ERROR:
        if (message.channel) {
          const error = new PushFloError(
            message.error ?? 'Unknown error',
            message.code ?? ERROR_CODES.SERVER_ERROR
          );
          this.subscriptions.handleError(message.channel, error);
        }
        break;
    }
  }
}
