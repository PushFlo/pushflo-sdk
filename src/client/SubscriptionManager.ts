import type { Message, SubscriptionOptions } from '../types/message.js';

interface SubscriptionEntry {
  channel: string;
  options: SubscriptionOptions;
  confirmed: boolean;
}

/**
 * Manages channel subscriptions
 */
export class SubscriptionManager {
  private subscriptions: Map<string, SubscriptionEntry> = new Map();

  /**
   * Add a subscription
   */
  add(channel: string, options: SubscriptionOptions = {}): void {
    this.subscriptions.set(channel, {
      channel,
      options,
      confirmed: false,
    });
  }

  /**
   * Remove a subscription
   */
  remove(channel: string): boolean {
    const entry = this.subscriptions.get(channel);
    if (entry) {
      this.subscriptions.delete(channel);
      entry.options.onUnsubscribed?.();
      return true;
    }
    return false;
  }

  /**
   * Check if subscribed to a channel
   */
  has(channel: string): boolean {
    return this.subscriptions.has(channel);
  }

  /**
   * Get subscription options for a channel
   */
  get(channel: string): SubscriptionOptions | undefined {
    return this.subscriptions.get(channel)?.options;
  }

  /**
   * Mark subscription as confirmed
   */
  confirm(channel: string): void {
    const entry = this.subscriptions.get(channel);
    if (entry) {
      entry.confirmed = true;
      entry.options.onSubscribed?.();
    }
  }

  /**
   * Check if subscription is confirmed
   */
  isConfirmed(channel: string): boolean {
    return this.subscriptions.get(channel)?.confirmed ?? false;
  }

  /**
   * Handle incoming message
   */
  handleMessage(message: Message): void {
    const entry = this.subscriptions.get(message.channel);
    if (entry) {
      entry.options.onMessage?.(message);
    }
  }

  /**
   * Handle subscription error
   */
  handleError(channel: string, error: Error): void {
    const entry = this.subscriptions.get(channel);
    if (entry) {
      entry.options.onError?.(error);
    }
  }

  /**
   * Get all subscribed channel names
   */
  getChannels(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get count of subscriptions
   */
  get size(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.forEach((entry) => {
      entry.options.onUnsubscribed?.();
    });
    this.subscriptions.clear();
  }

  /**
   * Reset confirmation status for all subscriptions (e.g., on reconnect)
   */
  resetConfirmations(): void {
    this.subscriptions.forEach((entry) => {
      entry.confirmed = false;
    });
  }
}
