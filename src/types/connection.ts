/**
 * Connection state of the PushFlo client
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Options for creating a PushFlo browser client
 */
export interface ClientOptions {
  /** Publish key for read/subscribe access (pub_xxx) */
  publishKey: string;

  /** Base URL for the PushFlo API */
  baseUrl?: string;

  /** Automatically connect on client creation */
  autoConnect?: boolean;

  /** Enable debug logging */
  debug?: boolean;

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
}

/**
 * Options for creating a PushFlo server client
 */
export interface ServerOptions {
  /** Secret key for read/write access (sec_xxx or mgmt_xxx) */
  secretKey: string;

  /** Base URL for the PushFlo Realtime API (publish, message history) */
  baseUrl?: string;

  /** Base URL for the PushFlo Console API (channel management) */
  consoleUrl?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Enable debug logging */
  debug?: boolean;

  /** Number of retry attempts for failed requests */
  retryAttempts?: number;
}

/**
 * WebSocket connection info received on successful connection
 */
export interface ConnectionInfo {
  /** Client ID assigned by the server */
  clientId: string;

  /** Server timestamp */
  timestamp: number;
}
