import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry, calculateBackoff, sleep } from '../../src/utils/retry.js';

describe('calculateBackoff', () => {
  it('should return initial delay for first attempt', () => {
    const delay = calculateBackoff(0, { initialDelay: 1000, maxDelay: 30000, multiplier: 2 });
    // With jitter, should be roughly 1000 ± 250
    expect(delay).toBeGreaterThanOrEqual(750);
    expect(delay).toBeLessThanOrEqual(1250);
  });

  it('should increase delay exponentially', () => {
    const delays = [0, 1, 2, 3].map((attempt) =>
      calculateBackoff(attempt, { initialDelay: 1000, maxDelay: 100000, multiplier: 2 })
    );

    // Each delay should be roughly double the previous (accounting for jitter)
    for (let i = 1; i < delays.length; i++) {
      const ratio = delays[i]! / delays[i - 1]!;
      expect(ratio).toBeGreaterThan(1.3); // Allow for jitter
      expect(ratio).toBeLessThan(3);
    }
  });

  it('should cap at maxDelay', () => {
    const delay = calculateBackoff(10, { initialDelay: 1000, maxDelay: 5000, multiplier: 2 });
    // With jitter, should be at most 5000 + 25%
    expect(delay).toBeLessThanOrEqual(6250);
  });

  it('should use default values', () => {
    const delay = calculateBackoff(0);
    expect(delay).toBeGreaterThan(0);
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after specified duration', async () => {
    const promise = sleep(1000);

    vi.advanceTimersByTime(999);
    await Promise.resolve(); // Let microtasks run

    vi.advanceTimersByTime(1);
    await expect(promise).resolves.toBeUndefined();
  });

  it('should reject immediately if signal already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(1000, controller.signal)).rejects.toThrow('Aborted');
  });

  it('should reject when signal is aborted', async () => {
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);

    vi.advanceTimersByTime(500);
    controller.abort();

    await expect(promise).rejects.toThrow('Aborted');
  });
});

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn, { maxAttempts: 3 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
    });

    // Advance past first retry delay
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max attempts', async () => {
    const errors: Error[] = [];
    const fn = vi.fn().mockImplementation(() => {
      const error = new Error('always fails');
      errors.push(error);
      return Promise.reject(error);
    });

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 50,
      maxDelay: 100,
    });

    // Advance timers for all retries
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry if isRetryable returns false', async () => {
    const error = new Error('not retryable');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      retry(fn, {
        maxAttempts: 3,
        isRetryable: () => false,
      })
    ).rejects.toThrow('not retryable');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');
    const onRetry = vi.fn();

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      onRetry,
    });

    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Error));
  });

  it('should abort with signal', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      signal: controller.signal,
    });

    // Abort immediately after first call
    controller.abort();
    vi.advanceTimersByTime(100);

    try {
      await promise;
    } catch (error) {
      expect((error as Error).name).toBe('AbortError');
    }
  });
});
