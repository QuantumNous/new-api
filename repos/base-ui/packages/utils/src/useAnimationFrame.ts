'use client';
import { useRefWithInit } from './useRefWithInit';
import { useOnMount } from './useOnMount';

type AnimationFrameId = number;

/** Unlike `setTimeout`, rAF doesn't guarantee a positive integer return value, so we can't have
 * a monomorphic `uint` type with `0` meaning empty.
 * See warning note at:
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame#return_value */
const EMPTY = null;

let LAST_RAF = globalThis.requestAnimationFrame;

class Scheduler {
  /* This implementation uses an array as a backing data-structure for frame callbacks.
   * It allows `O(1)` callback cancelling by inserting a `null` in the array, though it
   * never calls the native `cancelAnimationFrame` if there are no frames left. This can
   * be much more efficient if there is a call pattern that alterns as
   * "request-cancel-request-cancel-…".
   * But in the case of "request-request-…-cancel-cancel-…", it leaves the final animation
   * frame to run anyway. We turn that frame into a `O(1)` no-op via `callbacksCount`. */

  callbacks = [] as (FrameRequestCallback | null)[];

  callbacksCount = 0;

  nextId = 1;

  startId = 1;

  isScheduled = false;

  tick = (timestamp: number) => {
    this.isScheduled = false;

    const currentCallbacks = this.callbacks;
    const currentCallbacksCount = this.callbacksCount;

    // Update these before iterating, callbacks could call `requestAnimationFrame` again.
    this.callbacks = [];
    this.callbacksCount = 0;
    this.startId = this.nextId;

    if (currentCallbacksCount > 0) {
      for (let i = 0; i < currentCallbacks.length; i += 1) {
        currentCallbacks[i]?.(timestamp);
      }
    }
  };

  request(fn: FrameRequestCallback) {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.push(fn);
    this.callbacksCount += 1;

    /* In a test environment with fake timers, a fake `requestAnimationFrame` can be called
     * but there's no guarantee that the animation frame will actually run before the fake
     * timers are teared, which leaves `isScheduled` set, but won't run our `tick()`. */
    const didRAFChange =
      process.env.NODE_ENV !== 'production' &&
      LAST_RAF !== requestAnimationFrame &&
      ((LAST_RAF = requestAnimationFrame), true);

    if (!this.isScheduled || didRAFChange) {
      requestAnimationFrame(this.tick);
      this.isScheduled = true;
    }
    return id;
  }

  cancel(id: AnimationFrameId) {
    const index = id - this.startId;
    if (index < 0 || index >= this.callbacks.length) {
      return;
    }
    this.callbacks[index] = null;
    this.callbacksCount -= 1;
  }
}

const scheduler = new Scheduler();

export class AnimationFrame {
  static create() {
    return new AnimationFrame();
  }

  static request(fn: FrameRequestCallback) {
    return scheduler.request(fn);
  }

  static cancel(id: AnimationFrameId) {
    return scheduler.cancel(id);
  }

  currentId: AnimationFrameId | null = EMPTY;

  /**
   * Executes `fn` after `delay`, clearing any previously scheduled call.
   */
  request(fn: Function) {
    this.cancel();
    this.currentId = scheduler.request(() => {
      this.currentId = EMPTY;
      fn();
    });
  }

  cancel = () => {
    if (this.currentId !== EMPTY) {
      scheduler.cancel(this.currentId);
      this.currentId = EMPTY;
    }
  };

  disposeEffect = () => {
    return this.cancel;
  };
}

/**
 * A `requestAnimationFrame` with automatic cleanup and guard.
 */
export function useAnimationFrame() {
  const timeout = useRefWithInit(AnimationFrame.create).current;

  useOnMount(timeout.disposeEffect);

  return timeout;
}
