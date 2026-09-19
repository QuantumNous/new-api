import { DelayedPromise } from './delayed-promise';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('DelayedPromise', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve when accessed after resolution', async () => {
    const dp = new DelayedPromise<string>();
    dp.resolve('success');
    expect(await dp.promise).toBe('success');
  });

  it('should reject when accessed after rejection', async () => {
    const dp = new DelayedPromise<string>();
    const error = new Error('failure');
    dp.reject(error);
    await expect(dp.promise).rejects.toThrow('failure');
  });

  it('should resolve when accessed before resolution', async () => {
    const dp = new DelayedPromise<string>();
    const promise = dp.promise;
    dp.resolve('success');
    expect(await promise).toBe('success');
  });

  it('should reject when accessed before rejection', async () => {
    const dp = new DelayedPromise<string>();
    const promise = dp.promise;
    const error = new Error('failure');
    dp.reject(error);
    await expect(promise).rejects.toThrow('failure');
  });

  it('should maintain the resolved state after multiple accesses', async () => {
    const dp = new DelayedPromise<string>();
    dp.resolve('success');
    expect(await dp.promise).toBe('success');
    expect(await dp.promise).toBe('success');
  });

  it('should maintain the rejected state after multiple accesses', async () => {
    const dp = new DelayedPromise<string>();
    const error = new Error('failure');
    dp.reject(error);
    await expect(dp.promise).rejects.toThrow('failure');
    await expect(dp.promise).rejects.toThrow('failure');
  });

  it('should block until resolved when accessed before resolution', async () => {
    const dp = new DelayedPromise<string>();
    let resolved = false;

    // Access the promise before resolving
    const promise = dp.promise.then(value => {
      resolved = true;
      return value;
    });

    // Promise should not be resolved yet
    expect(resolved).toBe(false);

    // Wait a bit to ensure it's truly blocking
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);

    // Now resolve it
    dp.resolve('delayed-success');

    // Should now resolve
    const result = await promise;
    expect(result).toBe('delayed-success');
    expect(resolved).toBe(true);
  });

  it('should block until rejected when accessed before rejection', async () => {
    const dp = new DelayedPromise<string>();
    let rejected = false;

    // Access the promise before rejecting
    const promise = dp.promise.catch(error => {
      rejected = true;
      throw error;
    });

    // Promise should not be rejected yet
    expect(rejected).toBe(false);

    // Wait a bit to ensure it's truly blocking
    await vi.advanceTimersByTimeAsync(10);
    expect(rejected).toBe(false);

    // Now reject it
    const error = new Error('delayed-failure');
    dp.reject(error);

    // Should now reject
    await expect(promise).rejects.toThrow('delayed-failure');
    expect(rejected).toBe(true);
  });

  it('should resolve all pending promises when resolved after access', async () => {
    const dp = new DelayedPromise<string>();
    const results: string[] = [];

    // Access the promise multiple times before resolution
    const promise1 = dp.promise.then(value => {
      results.push(`first: ${value}`);
      return value;
    });

    const promise2 = dp.promise.then(value => {
      results.push(`second: ${value}`);
      return value;
    });

    // Neither should be resolved yet
    expect(results).toHaveLength(0);

    // Wait to ensure they're blocking
    await vi.advanceTimersByTimeAsync(10);
    expect(results).toHaveLength(0);

    // Resolve the promise
    dp.resolve('success');

    // Both should resolve
    await Promise.all([promise1, promise2]);
    expect(results).toHaveLength(2);
    expect(results).toContain('first: success');
    expect(results).toContain('second: success');
  });
});
