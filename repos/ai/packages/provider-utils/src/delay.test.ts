import { delay } from './delay';
import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic delay functionality', () => {
    it('should resolve after the specified delay', async () => {
      const delayPromise = delay(1000);

      // Promise should not be resolved immediately
      let resolved = false;
      delayPromise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      // Advance timers by less than the delay
      await vi.advanceTimersByTimeAsync(500);
      expect(resolved).toBe(false);

      // Advance timers to complete the delay
      await vi.advanceTimersByTimeAsync(500);
      expect(resolved).toBe(true);

      // Verify the promise resolves
      await expect(delayPromise).resolves.toBeUndefined();
    });

    it('should resolve immediately when delayInMs is null', async () => {
      const delayPromise = delay(null);
      await expect(delayPromise).resolves.toBeUndefined();
    });

    it('should resolve immediately when delayInMs is undefined', async () => {
      const delayPromise = delay(undefined);
      await expect(delayPromise).resolves.toBeUndefined();
    });

    it('should resolve immediately when delayInMs is 0', async () => {
      const delayPromise = delay(0);

      // Even with 0 delay, setTimeout is used, so we need to advance timers
      await vi.advanceTimersByTimeAsync(0);
      await expect(delayPromise).resolves.toBeUndefined();
    });
  });

  describe('abort signal functionality', () => {
    it('should reject immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const delayPromise = delay(1000, { abortSignal: controller.signal });

      await expect(delayPromise).rejects.toThrow('Delay was aborted');
      expect(vi.getTimerCount()).toBe(0); // No timer should be set
    });

    it('should reject when signal is aborted during delay', async () => {
      const controller = new AbortController();
      const delayPromise = delay(1000, { abortSignal: controller.signal });

      // Advance time partially
      await vi.advanceTimersByTimeAsync(500);

      // Abort the signal
      controller.abort();

      await expect(delayPromise).rejects.toThrow('Delay was aborted');
    });

    it('should clean up timeout when aborted', async () => {
      const controller = new AbortController();
      const delayPromise = delay(1000, { abortSignal: controller.signal });

      expect(vi.getTimerCount()).toBe(1);

      controller.abort();

      try {
        await delayPromise;
      } catch {
        // Expected to throw
      }

      expect(vi.getTimerCount()).toBe(0);
    });

    it('should clean up event listener when delay completes normally', async () => {
      const controller = new AbortController();
      const addEventListenerSpy = vi.spyOn(
        controller.signal,
        'addEventListener',
      );
      const removeEventListenerSpy = vi.spyOn(
        controller.signal,
        'removeEventListener',
      );

      const delayPromise = delay(1000, { abortSignal: controller.signal });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'abort',
        expect.any(Function),
      );

      await vi.advanceTimersByTimeAsync(1000);
      await delayPromise;

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'abort',
        expect.any(Function),
      );
    });

    it('should work without signal option', async () => {
      const delayPromise = delay(1000);

      await vi.advanceTimersByTimeAsync(1000);
      await expect(delayPromise).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should create proper DOMException for abort', async () => {
      const controller = new AbortController();
      controller.abort();

      const delayPromise = delay(1000, { abortSignal: controller.signal });

      try {
        await delayPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).message).toBe('Delay was aborted');
        expect((error as DOMException).name).toBe('AbortError');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very large delays', async () => {
      const delayPromise = delay(Number.MAX_SAFE_INTEGER);

      await vi.advanceTimersByTimeAsync(1000);
      let resolved = false;
      delayPromise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      // Fast forward to complete
      await vi.advanceTimersByTimeAsync(1000);
      await expect(delayPromise).resolves.toBeUndefined();
    });

    it('should handle negative delays (treated as 0)', async () => {
      const delayPromise = delay(-100);

      vi.advanceTimersByTime(0);
      await expect(delayPromise).resolves.toBeUndefined();
    });

    it('should handle multiple delays simultaneously', async () => {
      const delay1 = delay(100);
      const delay2 = delay(200);
      const delay3 = delay(300);

      let resolved1 = false;
      let resolved2 = false;
      let resolved3 = false;

      delay1.then(() => {
        resolved1 = true;
      });
      delay2.then(() => {
        resolved2 = true;
      });
      delay3.then(() => {
        resolved3 = true;
      });

      // After 100ms, only first should resolve
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved1).toBe(true);
      expect(resolved2).toBe(false);
      expect(resolved3).toBe(false);

      // After 200ms, first two should resolve
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved1).toBe(true);
      expect(resolved2).toBe(true);
      expect(resolved3).toBe(false);

      // After 300ms, all should resolve
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved1).toBe(true);
      expect(resolved2).toBe(true);
      expect(resolved3).toBe(true);
    });
  });
});
