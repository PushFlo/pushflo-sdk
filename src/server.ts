// Server client entry point

// Main server client
export { PushFloServer } from './server/PushFloServer.js';

// Errors
export { PushFloError } from './errors/PushFloError.js';
export { AuthenticationError } from './errors/AuthenticationError.js';
export { NetworkError } from './errors/NetworkError.js';
export { ValidationError } from './errors/ValidationError.js';

// Validation utilities
export {
  isValidChannelSlug,
  toChannelSlug,
  validateChannelSlug,
  MAX_SLUG_LENGTH,
  MIN_SLUG_LENGTH,
  type SlugValidationResult,
} from './utils/validation.js';

// Types
export type {
  ServerOptions,
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
} from './types/message.js';

export type {
  Pagination,
} from './types/api.js';
