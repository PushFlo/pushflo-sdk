import { describe, it, expect, vi } from 'vitest';
import { TypedEventEmitter } from '../../src/utils/EventEmitter.js';

interface TestEvents {
  [key: string]: unknown[];
  message: [string];
  error: [Error];
  data: [number, string];
}

class TestEmitter extends TypedEventEmitter<TestEvents> {
  // Expose emit for testing
  public testEmit<K extends keyof TestEvents>(event: K, ...args: TestEvents[K]): boolean {
    return this.emit(event, ...args);
  }
}

describe('TypedEventEmitter', () => {
  it('should register and call event handlers', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on('message', handler);
    emitter.testEmit('message', 'hello');

    expect(handler).toHaveBeenCalledWith('hello');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support multiple handlers for same event', () => {
    const emitter = new TestEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('message', handler1);
    emitter.on('message', handler2);
    emitter.testEmit('message', 'test');

    expect(handler1).toHaveBeenCalledWith('test');
    expect(handler2).toHaveBeenCalledWith('test');
  });

  it('should support multiple arguments', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on('data', handler);
    emitter.testEmit('data', 42, 'value');

    expect(handler).toHaveBeenCalledWith(42, 'value');
  });

  it('should remove handlers with off()', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on('message', handler);
    emitter.off('message', handler);
    emitter.testEmit('message', 'hello');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support once() for one-time handlers', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.once('message', handler);
    emitter.testEmit('message', 'first');
    emitter.testEmit('message', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('should return false when no handlers exist', () => {
    const emitter = new TestEmitter();
    const result = emitter.testEmit('message', 'test');

    expect(result).toBe(false);
  });

  it('should return true when handlers exist', () => {
    const emitter = new TestEmitter();
    emitter.on('message', vi.fn());
    const result = emitter.testEmit('message', 'test');

    expect(result).toBe(true);
  });

  it('should support method chaining', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    const result = emitter
      .on('message', handler)
      .on('error', vi.fn())
      .off('error', vi.fn());

    expect(result).toBe(emitter);
  });

  it('should remove all listeners for specific event', () => {
    const emitter = new TestEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('message', handler1);
    emitter.on('message', handler2);
    emitter.removeAllListeners('message');
    emitter.testEmit('message', 'test');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should remove all listeners when no event specified', () => {
    const emitter = new TestEmitter();
    const messageHandler = vi.fn();
    const errorHandler = vi.fn();

    emitter.on('message', messageHandler);
    emitter.on('error', errorHandler);
    emitter.removeAllListeners();
    emitter.testEmit('message', 'test');
    emitter.testEmit('error', new Error('test'));

    expect(messageHandler).not.toHaveBeenCalled();
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it('should return correct listener count', () => {
    const emitter = new TestEmitter();

    expect(emitter.listenerCount('message')).toBe(0);

    emitter.on('message', vi.fn());
    expect(emitter.listenerCount('message')).toBe(1);

    emitter.on('message', vi.fn());
    expect(emitter.listenerCount('message')).toBe(2);
  });

  it('should return event names with listeners', () => {
    const emitter = new TestEmitter();

    expect(emitter.eventNames()).toEqual([]);

    emitter.on('message', vi.fn());
    emitter.on('error', vi.fn());

    expect(emitter.eventNames()).toContain('message');
    expect(emitter.eventNames()).toContain('error');
  });

  it('should catch handler errors without breaking other handlers', () => {
    const emitter = new TestEmitter();
    const errorHandler = vi.fn(() => {
      throw new Error('Handler error');
    });
    const goodHandler = vi.fn();

    emitter.on('message', errorHandler);
    emitter.on('message', goodHandler);
    emitter.testEmit('message', 'test');

    expect(errorHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
  });
});
