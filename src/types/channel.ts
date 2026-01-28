/**
 * A PushFlo channel
 */
export interface Channel {
  /** Unique channel ID */
  id: string;

  /** Human-readable channel name */
  name: string;

  /** URL-safe channel identifier (used for subscriptions) */
  slug: string;

  /** Optional channel description */
  description: string | null;

  /** Whether the channel requires authentication */
  isPrivate: boolean;

  /** Custom metadata attached to the channel */
  metadata: Record<string, unknown> | null;

  /** Total number of messages in the channel */
  messageCount: number;

  /** ISO 8601 timestamp of creation */
  createdAt: string;

  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/**
 * Input for creating a new channel
 */
export interface ChannelInput {
  /** Human-readable channel name */
  name: string;

  /** URL-safe channel identifier */
  slug: string;

  /** Optional channel description */
  description?: string;

  /** Whether the channel requires authentication */
  isPrivate?: boolean;

  /** Custom metadata to attach to the channel */
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating an existing channel
 */
export interface ChannelUpdateInput {
  /** Human-readable channel name */
  name?: string;

  /** Optional channel description */
  description?: string | null;

  /** Whether the channel requires authentication */
  isPrivate?: boolean;

  /** Custom metadata to attach to the channel */
  metadata?: Record<string, unknown> | null;
}

/**
 * Options for listing channels
 */
export interface ListChannelsOptions {
  /** Page number (1-indexed) */
  page?: number;

  /** Number of items per page */
  pageSize?: number;
}
