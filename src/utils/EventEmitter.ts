/**
 * Type-safe event emitter with zero dependencies
 */
export type EventMap = {
  [key: string]: unknown[];
};

export type EventHandler<T extends unknown[]> = (...args: T) => void;

export class TypedEventEmitter<Events extends EventMap> {
  private listeners: Map<keyof Events, Set<EventHandler<unknown[]>>> = new Map();

  /**
   * Register an event listener
   */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown[]>);
    return this;
  }

  /**
   * Register a one-time event listener
   */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): this {
    const onceHandler: EventHandler<Events[K]> = (...args) => {
      this.off(event, onceHandler);
      handler(...args);
    };
    return this.on(event, onceHandler);
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): this {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown[]>);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  /**
   * Emit an event to all registered listeners
   */
  protected emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) {
      return false;
    }
    handlers.forEach((handler) => {
      try {
        handler(...args);
      } catch (error) {
        // Prevent handler errors from breaking other listeners
        console.error(`Error in event handler for "${String(event)}":`, error);
      }
    });
    return true;
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   */
  removeAllListeners<K extends keyof Events>(event?: K): this {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all event names with registered listeners
   */
  eventNames(): (keyof Events)[] {
    return Array.from(this.listeners.keys());
  }
}
