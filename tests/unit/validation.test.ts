import { describe, it, expect } from 'vitest';
import {
  isValidChannelSlug,
  toChannelSlug,
  validateChannelSlug,
  MAX_SLUG_LENGTH,
  MIN_SLUG_LENGTH,
} from '../../src/utils/validation';

describe('Channel Slug Validation', () => {
  describe('isValidChannelSlug', () => {
    it('should accept valid slugs', () => {
      expect(isValidChannelSlug('my-channel')).toBe(true);
      expect(isValidChannelSlug('channel-123')).toBe(true);
      expect(isValidChannelSlug('a')).toBe(true);
      expect(isValidChannelSlug('abc')).toBe(true);
      expect(isValidChannelSlug('123')).toBe(true);
      expect(isValidChannelSlug('my-awesome-channel')).toBe(true);
      expect(isValidChannelSlug('org-123-brand-456')).toBe(true);
    });

    it('should reject uppercase characters', () => {
      expect(isValidChannelSlug('My-Channel')).toBe(false);
      expect(isValidChannelSlug('CHANNEL')).toBe(false);
      expect(isValidChannelSlug('myChannel')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidChannelSlug('my:channel')).toBe(false);
      expect(isValidChannelSlug('my_channel')).toBe(false);
      expect(isValidChannelSlug('my.channel')).toBe(false);
      expect(isValidChannelSlug('my/channel')).toBe(false);
      expect(isValidChannelSlug('my@channel')).toBe(false);
      expect(isValidChannelSlug('my channel')).toBe(false);
    });

    it('should reject leading/trailing hyphens', () => {
      expect(isValidChannelSlug('-channel')).toBe(false);
      expect(isValidChannelSlug('channel-')).toBe(false);
      expect(isValidChannelSlug('-channel-')).toBe(false);
    });

    it('should reject consecutive hyphens', () => {
      expect(isValidChannelSlug('my--channel')).toBe(false);
      expect(isValidChannelSlug('a---b')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidChannelSlug('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidChannelSlug(null as unknown as string)).toBe(false);
      expect(isValidChannelSlug(undefined as unknown as string)).toBe(false);
    });

    it('should reject slugs exceeding max length', () => {
      const longSlug = 'a'.repeat(MAX_SLUG_LENGTH + 1);
      expect(isValidChannelSlug(longSlug)).toBe(false);
    });

    it('should accept slugs at max length', () => {
      const maxSlug = 'a'.repeat(MAX_SLUG_LENGTH);
      expect(isValidChannelSlug(maxSlug)).toBe(true);
    });
  });

  describe('toChannelSlug', () => {
    it('should convert to lowercase', () => {
      expect(toChannelSlug('My-Channel')).toBe('my-channel');
      expect(toChannelSlug('CHANNEL')).toBe('channel');
    });

    it('should replace special characters with hyphens', () => {
      expect(toChannelSlug('my:channel')).toBe('my-channel');
      expect(toChannelSlug('my_channel')).toBe('my-channel');
      expect(toChannelSlug('my.channel')).toBe('my-channel');
      expect(toChannelSlug('my channel')).toBe('my-channel');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(toChannelSlug('  -my-channel-  ')).toBe('my-channel');
      expect(toChannelSlug('___test___')).toBe('test');
    });

    it('should collapse consecutive hyphens', () => {
      expect(toChannelSlug('my---channel')).toBe('my-channel');
      expect(toChannelSlug('a   b   c')).toBe('a-b-c');
    });

    it('should handle complex conversions', () => {
      expect(toChannelSlug('user:123:messages')).toBe('user-123-messages');
      expect(toChannelSlug('apipact:org:abc123:brand:xyz789:emails')).toBe('apipact-org-abc123-brand-xyz789-emails');
    });

    it('should truncate to max length', () => {
      const longStr = 'a'.repeat(100);
      expect(toChannelSlug(longStr).length).toBe(MAX_SLUG_LENGTH);
    });
  });

  describe('validateChannelSlug', () => {
    it('should return valid for valid slugs', () => {
      const result = validateChannelSlug('my-channel');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for uppercase', () => {
      const result = validateChannelSlug('My-Channel');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
      expect(result.suggestion).toBe('my-channel');
    });

    it('should return error for special characters', () => {
      const result = validateChannelSlug('my:channel');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
      expect(result.error).toContain(':');
      expect(result.suggestion).toBe('my-channel');
    });

    it('should return error for leading hyphen', () => {
      const result = validateChannelSlug('-channel');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('start');
    });

    it('should return error for trailing hyphen', () => {
      const result = validateChannelSlug('channel-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('end');
    });

    it('should return error for consecutive hyphens', () => {
      const result = validateChannelSlug('my--channel');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive');
    });

    it('should return error for too long slug', () => {
      const longSlug = 'a'.repeat(MAX_SLUG_LENGTH + 1);
      const result = validateChannelSlug(longSlug);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
      expect(result.error).toContain(String(MAX_SLUG_LENGTH));
    });

    it('should return error for empty string', () => {
      const result = validateChannelSlug('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('constants', () => {
    it('should have sensible defaults', () => {
      expect(MIN_SLUG_LENGTH).toBe(1);
      expect(MAX_SLUG_LENGTH).toBe(64);
    });
  });
});
