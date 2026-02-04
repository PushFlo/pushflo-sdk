/**
 * A message received from a PushFlo channel
 */
export interface Message {
  /** Unique message ID */
  id: string;

  /** Channel slug the message was published to */
  channel: string;

  /** Event type for filtering/routing */
  eventType: string;

  /** ID of the client that published the message */
  clientId: string;

  /** Message payload */
  content: Record<string, unknown>;

  /** Unix timestamp (milliseconds) of when the message was published */
  timestamp: number;
}

/**
 * Options for publishing a message
 */
export interface PublishOptions {
  /** Event type for filtering/routing (default: 'message') */
  eventType?: string;
}

/**
 * Result of publishing a message
 */
export interface PublishResult {
  /** Unique message ID */
  id: string;

  /** Channel slug the message was published to */
  channelSlug: string;

  /** Event type of the message */
  eventType: string;

  /** Client ID that published the message */
  clientId: string;

  /** Number of subscribers the message was delivered to */
  delivered: number;

  /** ISO 8601 timestamp of when the message was published */
  createdAt: string;
}

/**
 * Options for fetching message history
 */
export interface MessageHistoryOptions {
  /** Page number (1-indexed) */
  page?: number;

  /** Number of items per page */
  pageSize?: number;

  /** Filter by event type */
  eventType?: string;

  /** Fetch messages after this timestamp */
  after?: number;

  /** Fetch messages before this timestamp */
  before?: number;
}

/**
 * A subscription to a channel
 */
export interface Subscription {
  /** Channel slug */
  channel: string;

  /** Unsubscribe from the channel */
  unsubscribe: () => void;
}

/**
 * Options for subscribing to a channel
 */
export interface SubscriptionOptions {
  /** Callback for received messages */
  onMessage?: (message: Message) => void;

  /** Callback for subscription errors */
  onError?: (error: Error) => void;

  /** Callback when subscription is confirmed */
  onSubscribed?: () => void;

  /** Callback when unsubscribed */
  onUnsubscribed?: () => void;
}
