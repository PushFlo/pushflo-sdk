import { RestClient } from './RestClient.js';
import { API_PATHS, DEFAULTS } from '../utils/constants.js';
import { AuthenticationError } from '../errors/AuthenticationError.js';
import type { ServerOptions } from '../types/connection.js';
import type {
  Channel,
  ChannelInput,
  ChannelUpdateInput,
  ListChannelsOptions,
} from '../types/channel.js';
import type {
  Message,
  PublishOptions,
  PublishResult,
  MessageHistoryOptions,
} from '../types/message.js';
import type { Pagination } from '../types/api.js';

interface ChannelsResponse {
  channels: Channel[];
  pagination: Pagination;
}

interface MessagesResponse {
  items: Message[];
  pagination: Pagination;
}

/**
 * Server-side PushFlo client for publishing messages and managing channels
 */
export class PushFloServer {
  private readonly client: RestClient;

  constructor(options: ServerOptions) {
    if (!options.secretKey) {
      throw new AuthenticationError(
        'Secret key is required',
        'MISSING_SECRET_KEY'
      );
    }

    if (!options.secretKey.startsWith('sec_') && !options.secretKey.startsWith('mgmt_')) {
      throw AuthenticationError.invalidKey('secret');
    }

    this.client = new RestClient({
      apiKey: options.secretKey,
      baseUrl: options.baseUrl,
      timeout: options.timeout,
      retryAttempts: options.retryAttempts,
      debug: options.debug,
    });
  }

  // ============================================
  // Channel Management
  // ============================================

  /**
   * List all channels
   */
  async listChannels(
    options: ListChannelsOptions = {}
  ): Promise<{ channels: Channel[]; pagination: Pagination }> {
    const response = await this.client.get<ChannelsResponse>(API_PATHS.CHANNELS, {
      page: options.page,
      pageSize: options.pageSize ?? DEFAULTS.PAGE_SIZE,
    });

    return {
      channels: response.channels,
      pagination: response.pagination,
    };
  }

  /**
   * Get a channel by slug
   */
  async getChannel(slug: string): Promise<Channel> {
    return this.client.get<Channel>(API_PATHS.CHANNEL(slug));
  }

  /**
   * Create a new channel
   */
  async createChannel(input: ChannelInput): Promise<Channel> {
    return this.client.post<Channel>(API_PATHS.CHANNELS, input);
  }

  /**
   * Update an existing channel
   */
  async updateChannel(slug: string, input: ChannelUpdateInput): Promise<Channel> {
    return this.client.patch<Channel>(API_PATHS.CHANNEL(slug), input);
  }

  /**
   * Delete a channel
   */
  async deleteChannel(slug: string): Promise<void> {
    await this.client.delete<void>(API_PATHS.CHANNEL(slug));
  }

  // ============================================
  // Message Publishing
  // ============================================

  /**
   * Publish a message to a channel
   */
  async publish(
    channel: string,
    content: Record<string, unknown>,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    return this.client.post<PublishResult>(API_PATHS.CHANNEL_MESSAGES(channel), {
      content,
      eventType: options.eventType ?? 'message',
    });
  }

  /**
   * Get message history for a channel
   */
  async getMessageHistory(
    channel: string,
    options: MessageHistoryOptions = {}
  ): Promise<{ messages: Message[]; pagination: Pagination }> {
    const response = await this.client.get<MessagesResponse>(
      API_PATHS.CHANNEL_MESSAGES(channel),
      {
        page: options.page,
        pageSize: options.pageSize ?? DEFAULTS.PAGE_SIZE,
        eventType: options.eventType,
        after: options.after,
        before: options.before,
      }
    );

    return {
      messages: response.items,
      pagination: response.pagination,
    };
  }
}
