'use client';
import { useRefWithInit } from './useRefWithInit';
import { useOnMount } from './useOnMount';
import { Timeout } from './useTimeout';

type IntervalId = number;

const EMPTY = 0 as IntervalId;

export class Interval extends Timeout {
  static create() {
    return new Interval();
  }

  /**
   * Executes `fn` at `delay` interval, clearing any previously scheduled call.
   */
  start(delay: number, fn: Function) {
    this.clear();
    this.currentId = setInterval(() => {
      fn();
    }, delay) as unknown as number;
  }

  clear = () => {
    if (this.currentId !== EMPTY) {
      clearInterval(this.currentId as IntervalId);
      this.currentId = EMPTY;
    }
  };
}

/**
 * A `setInterval` with automatic cleanup and guard.
 */
export function useInterval() {
  const timeout = useRefWithInit(Interval.create).current;

  useOnMount(timeout.disposeEffect);

  return timeout;
}
