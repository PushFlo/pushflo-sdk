import { describe, it, expect, vi } from 'vitest';
import { SubscriptionManager } from '../../src/client/SubscriptionManager.js';
import type { Message } from '../../src/types/message.js';

describe('SubscriptionManager', () => {
  const createMessage = (channel: string, content = {}): Message => ({
    id: 'msg-1',
    channel,
    eventType: 'message',
    clientId: 'client-1',
    content,
    timestamp: Date.now(),
  });

  it('should add subscription', () => {
    const manager = new SubscriptionManager();

    manager.add('test-channel', {});

    expect(manager.has('test-channel')).toBe(true);
    expect(manager.size).toBe(1);
  });

  it('should remove subscription', () => {
    const manager = new SubscriptionManager();
    manager.add('test-channel', {});

    const removed = manager.remove('test-channel');

    expect(removed).toBe(true);
    expect(manager.has('test-channel')).toBe(false);
    expect(manager.size).toBe(0);
  });

  it('should return false when removing non-existent subscription', () => {
    const manager = new SubscriptionManager();

    expect(manager.remove('non-existent')).toBe(false);
  });

  it('should get subscription options', () => {
    const manager = new SubscriptionManager();
    const options = { onMessage: vi.fn() };
    manager.add('test-channel', options);

    expect(manager.get('test-channel')).toBe(options);
  });

  it('should return undefined for non-existent subscription', () => {
    const manager = new SubscriptionManager();

    expect(manager.get('non-existent')).toBeUndefined();
  });

  it('should confirm subscription', () => {
    const manager = new SubscriptionManager();
    const onSubscribed = vi.fn();
    manager.add('test-channel', { onSubscribed });

    expect(manager.isConfirmed('test-channel')).toBe(false);

    manager.confirm('test-channel');

    expect(manager.isConfirmed('test-channel')).toBe(true);
    expect(onSubscribed).toHaveBeenCalled();
  });

  it('should handle message', () => {
    const manager = new SubscriptionManager();
    const onMessage = vi.fn();
    manager.add('test-channel', { onMessage });

    const message = createMessage('test-channel', { text: 'hello' });
    manager.handleMessage(message);

    expect(onMessage).toHaveBeenCalledWith(message);
  });

  it('should not call handler for unsubscribed channel', () => {
    const manager = new SubscriptionManager();
    const onMessage = vi.fn();
    manager.add('test-channel', { onMessage });

    const message = createMessage('other-channel');
    manager.handleMessage(message);

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('should handle error', () => {
    const manager = new SubscriptionManager();
    const onError = vi.fn();
    manager.add('test-channel', { onError });

    const error = new Error('Test error');
    manager.handleError('test-channel', error);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should get all subscribed channels', () => {
    const manager = new SubscriptionManager();
    manager.add('channel-1', {});
    manager.add('channel-2', {});
    manager.add('channel-3', {});

    const channels = manager.getChannels();

    expect(channels).toContain('channel-1');
    expect(channels).toContain('channel-2');
    expect(channels).toContain('channel-3');
    expect(channels.length).toBe(3);
  });

  it('should clear all subscriptions', () => {
    const manager = new SubscriptionManager();
    const onUnsubscribed = vi.fn();
    manager.add('channel-1', { onUnsubscribed });
    manager.add('channel-2', { onUnsubscribed });

    manager.clear();

    expect(manager.size).toBe(0);
    expect(onUnsubscribed).toHaveBeenCalledTimes(2);
  });

  it('should reset confirmations', () => {
    const manager = new SubscriptionManager();
    manager.add('channel-1', {});
    manager.add('channel-2', {});
    manager.confirm('channel-1');
    manager.confirm('channel-2');

    manager.resetConfirmations();

    expect(manager.isConfirmed('channel-1')).toBe(false);
    expect(manager.isConfirmed('channel-2')).toBe(false);
  });

  it('should call onUnsubscribed when removed', () => {
    const manager = new SubscriptionManager();
    const onUnsubscribed = vi.fn();
    manager.add('test-channel', { onUnsubscribed });

    manager.remove('test-channel');

    expect(onUnsubscribed).toHaveBeenCalled();
  });
});
