import { RestClient } from './RestClient.js';
import { API_PATHS, DEFAULTS } from '../utils/constants.js';
import { AuthenticationError } from '../errors/AuthenticationError.js';
import { ValidationError } from '../errors/ValidationError.js';
import { validateChannelSlug } from '../utils/validation.js';
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
  data: Channel[];
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
      channels: response.data,
      pagination: response.pagination,
    };
  }

  /**
   * Get a channel by slug
   */
  async getChannel(slug: string): Promise<Channel> {
    this.validateSlug(slug);
    return this.client.get<Channel>(API_PATHS.CHANNEL(slug));
  }

  /**
   * Create a new channel
   *
   * @throws {ValidationError} If the channel slug is invalid
   */
  async createChannel(input: ChannelInput): Promise<Channel> {
    this.validateSlug(input.slug);
    return this.client.post<Channel>(API_PATHS.CHANNELS, input);
  }

  /**
   * Update an existing channel
   */
  async updateChannel(slug: string, input: ChannelUpdateInput): Promise<Channel> {
    this.validateSlug(slug);
    return this.client.patch<Channel>(API_PATHS.CHANNEL(slug), input);
  }

  /**
   * Delete a channel
   */
  async deleteChannel(slug: string): Promise<void> {
    this.validateSlug(slug);
    await this.client.delete<void>(API_PATHS.CHANNEL(slug));
  }

  /**
   * Validate a channel slug and throw if invalid
   */
  private validateSlug(slug: string): void {
    const result = validateChannelSlug(slug);
    if (!result.valid) {
      const error = ValidationError.invalidChannelSlug(slug);
      if (result.suggestion) {
        error.message += `. Suggested: '${result.suggestion}'`;
      }
      throw error;
    }
  }

  // ============================================
  // Message Publishing
  // ============================================

  /**
   * Publish a message to a channel
   *
   * @throws {ValidationError} If the channel slug is invalid
   */
  async publish(
    channel: string,
    content: Record<string, unknown>,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    this.validateSlug(channel);
    return this.client.post<PublishResult>(API_PATHS.CHANNEL_MESSAGES(channel), {
      content,
      eventType: options.eventType ?? 'message',
    });
  }

  /**
   * Get message history for a channel
   *
   * @throws {ValidationError} If the channel slug is invalid
   */
  async getMessageHistory(
    channel: string,
    options: MessageHistoryOptions = {}
  ): Promise<{ messages: Message[]; pagination: Pagination }> {
    this.validateSlug(channel);
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
