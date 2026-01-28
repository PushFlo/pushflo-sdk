/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default PushFlo API base URL */
  BASE_URL: 'https://api.pushflo.dev',

  /** WebSocket endpoint path */
  WS_PATH: '/ws',

  /** API version prefix */
  API_VERSION: '/api/v1',

  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT: 30000,

  /** Heartbeat interval in milliseconds */
  HEARTBEAT_INTERVAL: 25000,

  /** Initial reconnection delay in milliseconds */
  RECONNECT_DELAY: 1000,

  /** Maximum reconnection delay in milliseconds */
  MAX_RECONNECT_DELAY: 30000,

  /** Reconnection delay multiplier for exponential backoff */
  RECONNECT_MULTIPLIER: 1.5,

  /** Maximum number of reconnection attempts (0 = infinite) */
  MAX_RECONNECT_ATTEMPTS: 0,

  /** Default page size for list operations */
  PAGE_SIZE: 25,
} as const;

/**
 * API endpoint paths
 */
export const API_PATHS = {
  AUTH_TOKEN: '/auth/token',
  CHANNELS: '/channels',
  CHANNEL: (slug: string) => `/channels/${encodeURIComponent(slug)}`,
  CHANNEL_MESSAGES: (slug: string) => `/channels/${encodeURIComponent(slug)}/messages`,
} as const;

/**
 * WebSocket message types (client -> server)
 */
export const WS_CLIENT_MESSAGES = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  PING: 'ping',
  ACK: 'ack',
} as const;

/**
 * WebSocket message types (server -> client)
 */
export const WS_SERVER_MESSAGES = {
  CONNECTED: 'connected',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
  MESSAGE: 'message',
  ERROR: 'error',
  PONG: 'pong',
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_CLOSED: 'CONNECTION_CLOSED',

  // Authentication errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',

  // API errors
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',

  // Client errors
  INVALID_STATE: 'INVALID_STATE',
  ALREADY_CONNECTED: 'ALREADY_CONNECTED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
} as const;
