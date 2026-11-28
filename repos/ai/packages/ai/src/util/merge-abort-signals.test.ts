import { describe, expect, it } from 'vitest';
import { mergeAbortSignals } from './merge-abort-signals';

describe('mergeAbortSignals', () => {
  it('should return a signal that is initially not aborted', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const merged = mergeAbortSignals(controller1.signal, controller2.signal);

    expect(merged!.aborted).toBe(false);
  });

  it('should abort when the first signal aborts', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const merged = mergeAbortSignals(controller1.signal, controller2.signal);

    controller1.abort();

    expect(merged!.aborted).toBe(true);
  });

  it('should abort when the second signal aborts', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const merged = mergeAbortSignals(controller1.signal, controller2.signal);

    controller2.abort();

    expect(merged!.aborted).toBe(true);
  });

  it('should preserve the abort reason from the triggering signal', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const reason = new Error('custom abort reason');

    const merged = mergeAbortSignals(controller1.signal, controller2.signal);

    controller1.abort(reason);

    expect(merged!.reason).toBe(reason);
  });

  it('should preserve string abort reason', () => {
    const controller1 = new AbortController();

    const merged = mergeAbortSignals(controller1.signal);

    controller1.abort('string reason');

    expect(merged!.reason).toBe('string reason');
  });

  it('should handle already-aborted signals', () => {
    const controller1 = new AbortController();
    const reason = new Error('already aborted');
    controller1.abort(reason);

    const merged = mergeAbortSignals(controller1.signal);

    expect(merged!.aborted).toBe(true);
    expect(merged!.reason).toBe(reason);
  });

  it('should use the first already-aborted signal reason when multiple are aborted', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const reason1 = new Error('first reason');
    const reason2 = new Error('second reason');

    controller1.abort(reason1);
    controller2.abort(reason2);

    const merged = mergeAbortSignals(controller1.signal, controller2.signal);

    expect(merged!.aborted).toBe(true);
    expect(merged!.reason).toBe(reason1);
  });

  it('should return undefined when no signals provided', () => {
    const merged = mergeAbortSignals();

    expect(merged).toBeUndefined();
  });

  it('should return undefined when only null/undefined signals provided', () => {
    const merged = mergeAbortSignals(null, undefined, null);

    expect(merged).toBeUndefined();
  });

  it('should create a timeout signal from numeric input', async () => {
    const merged = mergeAbortSignals(10);

    expect(merged).toBeInstanceOf(AbortSignal);
    expect(merged!.aborted).toBe(false);

    await new Promise<void>(resolve => {
      merged!.addEventListener('abort', () => resolve(), { once: true });
    });

    expect(merged!.aborted).toBe(true);
    expect(merged!.reason).toBeInstanceOf(DOMException);
    expect((merged!.reason as DOMException).name).toBe('TimeoutError');
  });

  it('should preserve the first abort reason when mixing signals and timeouts', () => {
    const controller = new AbortController();
    const reason = new Error('manual abort reason');
    const merged = mergeAbortSignals(controller.signal, 100);

    controller.abort(reason);

    expect(merged!.aborted).toBe(true);
    expect(merged!.reason).toBe(reason);
  });

  it('should filter out null and undefined signals', () => {
    const controller = new AbortController();
    const reason = new Error('abort reason');

    const merged = mergeAbortSignals(null, controller.signal, undefined);

    expect(merged).not.toBeUndefined();
    expect(merged!.aborted).toBe(false);

    controller.abort(reason);

    expect(merged!.aborted).toBe(true);
    expect(merged!.reason).toBe(reason);
  });

  it('should return the signal directly when only one valid signal provided', () => {
    const controller = new AbortController();

    const merged = mergeAbortSignals(null, controller.signal, undefined);

    expect(merged).toBe(controller.signal);
  });

  it('should use the first aborting signal reason when multiple abort simultaneously', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const reason1 = new Error('first reason');
    const reason2 = new Error('second reason');

    const merged = mergeAbortSignals(controller1.signal, controller2.signal);

    // Both abort, but the first one's listener was registered first
    controller1.abort(reason1);
    controller2.abort(reason2);

    expect(merged!.reason).toBe(reason1);
  });

  it('should return the original signal when only one signal provided', () => {
    const controller = new AbortController();

    const merged = mergeAbortSignals(controller.signal);

    expect(merged).toBe(controller.signal);
  });

  it('should work with many signals', () => {
    const controllers = Array.from({ length: 10 }, () => new AbortController());
    const reason = new Error('signal 5 reason');

    const merged = mergeAbortSignals(...controllers.map(c => c.signal));

    expect(merged!.aborted).toBe(false);

    controllers[5].abort(reason);

    expect(merged!.aborted).toBe(true);
    expect(merged!.reason).toBe(reason);
  });
});
