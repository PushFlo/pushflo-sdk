// Browser client entry point

// Main client
export { PushFloClient } from './client/PushFloClient.js';

// Errors
export { PushFloError } from './errors/PushFloError.js';
export { ConnectionError } from './errors/ConnectionError.js';
export { AuthenticationError } from './errors/AuthenticationError.js';
export { NetworkError } from './errors/NetworkError.js';

// Types
export type {
  ConnectionState,
  ClientOptions,
  ConnectionInfo,
} from './types/connection.js';

export type {
  Channel,
  ChannelInput,
  ChannelUpdateInput,
  ListChannelsOptions,
} from './types/channel.js';

export type {
  Message,
  PublishOptions,
  PublishResult,
  MessageHistoryOptions,
  Subscription,
  SubscriptionOptions,
} from './types/message.js';

export type {
  Pagination,
} from './types/api.js';
