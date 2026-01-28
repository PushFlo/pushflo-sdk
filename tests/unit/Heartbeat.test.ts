import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Heartbeat } from '../../src/client/Heartbeat.js';

describe('Heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send ping after interval', () => {
    const onPing = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      onPing,
    });

    heartbeat.start();

    expect(onPing).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onPing).toHaveBeenCalledTimes(1);
  });

  it('should call onTimeout when pong not received', () => {
    const onPing = vi.fn();
    const onTimeout = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      pongTimeout: 2000,
      onPing,
      onTimeout,
    });

    heartbeat.start();

    // Advance to ping
    vi.advanceTimersByTime(1000);
    expect(onPing).toHaveBeenCalled();

    // Advance past pong timeout
    vi.advanceTimersByTime(2000);
    expect(onTimeout).toHaveBeenCalled();
  });

  it('should not timeout when pong received', () => {
    const onPing = vi.fn();
    const onTimeout = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      pongTimeout: 2000,
      onPing,
      onTimeout,
    });

    heartbeat.start();

    // Advance to ping
    vi.advanceTimersByTime(1000);
    expect(onPing).toHaveBeenCalled();

    // Receive pong before timeout
    vi.advanceTimersByTime(500);
    heartbeat.receivedPong();

    // Advance past original timeout
    vi.advanceTimersByTime(1500);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should schedule next ping after pong', () => {
    const onPing = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      onPing,
    });

    heartbeat.start();

    // First ping
    vi.advanceTimersByTime(1000);
    expect(onPing).toHaveBeenCalledTimes(1);

    // Receive pong
    heartbeat.receivedPong();

    // Second ping after interval
    vi.advanceTimersByTime(1000);
    expect(onPing).toHaveBeenCalledTimes(2);
  });

  it('should stop sending pings when stopped', () => {
    const onPing = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      onPing,
    });

    heartbeat.start();

    // First ping
    vi.advanceTimersByTime(1000);
    expect(onPing).toHaveBeenCalledTimes(1);

    heartbeat.stop();

    // Should not get second ping
    vi.advanceTimersByTime(2000);
    expect(onPing).toHaveBeenCalledTimes(1);
  });

  it('should not start if already running', () => {
    const onPing = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      onPing,
    });

    heartbeat.start();
    heartbeat.start(); // Should be ignored

    vi.advanceTimersByTime(1000);
    expect(onPing).toHaveBeenCalledTimes(1);
  });

  it('should reset timer', () => {
    const onPing = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      onPing,
    });

    heartbeat.start();

    // Advance partway
    vi.advanceTimersByTime(500);

    // Reset
    heartbeat.reset();

    // Should need full interval again
    vi.advanceTimersByTime(500);
    expect(onPing).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onPing).toHaveBeenCalledTimes(1);
  });

  it('should use default pong timeout of 2x interval', () => {
    const onPing = vi.fn();
    const onTimeout = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      onPing,
      onTimeout,
    });

    heartbeat.start();

    // Advance to ping
    vi.advanceTimersByTime(1000);

    // Advance to default timeout (2x interval)
    vi.advanceTimersByTime(2000);
    expect(onTimeout).toHaveBeenCalled();
  });

  it('should ignore receivedPong when not running', () => {
    const onPing = vi.fn();
    const heartbeat = new Heartbeat({
      interval: 1000,
      onPing,
    });

    // Should not throw
    heartbeat.receivedPong();
    expect(onPing).not.toHaveBeenCalled();
  });
});
