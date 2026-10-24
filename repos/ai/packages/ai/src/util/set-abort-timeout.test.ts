import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAbortTimeout } from './set-abort-timeout';

describe('setAbortTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not abort the controller before the timeout elapses', () => {
    const abortController = new AbortController();

    setAbortTimeout({ abortController, label: 'Step', timeoutMs: 100 });
    vi.advanceTimersByTime(99);

    expect(abortController.signal.aborted).toBe(false);
  });

  it('should abort the controller when the timeout elapses', () => {
    const abortController = new AbortController();

    setAbortTimeout({ abortController, label: 'Step', timeoutMs: 100 });
    vi.advanceTimersByTime(100);

    expect(abortController.signal.aborted).toBe(true);
  });

  it('should abort with a TimeoutError DOMException', () => {
    const abortController = new AbortController();

    setAbortTimeout({ abortController, label: 'Step', timeoutMs: 100 });
    vi.advanceTimersByTime(100);

    expect(abortController.signal.reason).toBeInstanceOf(DOMException);
    expect((abortController.signal.reason as DOMException).name).toBe(
      'TimeoutError',
    );
  });

  it('should include the label and duration in the abort reason message', () => {
    const abortController = new AbortController();

    setAbortTimeout({ abortController, label: 'Chunk', timeoutMs: 250 });
    vi.advanceTimersByTime(250);

    expect((abortController.signal.reason as DOMException).message).toBe(
      'Chunk timeout of 250ms exceeded',
    );
  });

  it('should return a timeout id that can be cleared to cancel the abort', () => {
    const abortController = new AbortController();

    const id = setAbortTimeout({
      abortController,
      label: 'Step',
      timeoutMs: 100,
    });
    clearTimeout(id);
    vi.advanceTimersByTime(100);

    expect(abortController.signal.aborted).toBe(false);
  });

  it('should return undefined when abortController is undefined', () => {
    const id = setAbortTimeout({
      abortController: undefined,
      label: 'Step',
      timeoutMs: 100,
    });

    expect(id).toBeUndefined();
  });

  it('should return undefined when timeoutMs is undefined', () => {
    const abortController = new AbortController();

    const id = setAbortTimeout({
      abortController,
      label: 'Step',
      timeoutMs: undefined,
    });
    vi.advanceTimersByTime(1000);

    expect(id).toBeUndefined();
    expect(abortController.signal.aborted).toBe(false);
  });
});
