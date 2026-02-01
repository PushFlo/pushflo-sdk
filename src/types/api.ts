/**
 * Pagination metadata for list responses
 */
export interface Pagination {
  /** Current page number (1-indexed) */
  page: number;

  /** Number of items per page */
  pageSize: number;

  /** Total number of items */
  total: number;

  /** Total number of pages */
  totalPages: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;

  /** Whether the request was successful */
  success: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  /** Response data */
  data: T[];

  /** Pagination metadata */
  pagination: Pagination;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;

  /** Error code */
  code?: string;

  /** Field-specific validation errors */
  details?: Record<string, string[]>;
}

/**
 * WebSocket message from client to server
 */
export interface WsClientMessage {
  /** Message type */
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'ack';

  /** Channel slug (for subscribe/unsubscribe) */
  channel?: string;

  /** Message ID (for ack) */
  messageId?: string;
}

/**
 * WebSocket message from server to client
 */
export interface WsServerMessage {
  /** Message type */
  type: 'connected' | 'subscribed' | 'unsubscribed' | 'message' | 'error' | 'pong';

  /** Client ID (for connected, or sender for message) */
  clientId?: string;

  /** Channel slug (for subscribed/unsubscribed/message) */
  channel?: string;

  /** Message ID (for message) */
  messageId?: string;

  /** Event type (for message) */
  eventType?: string;

  /** Message payload (for message) */
  data?: Record<string, unknown>;

  /** Error message (for error) */
  error?: string;

  /** Error code (for error) */
  code?: string;

  /** Timestamp */
  timestamp?: number;
}
