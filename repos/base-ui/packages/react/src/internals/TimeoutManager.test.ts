import { expect, vi } from 'vitest';
import { TimeoutManager } from './TimeoutManager';

describe('TimeoutManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the callback after the specified delay', () => {
    const manager = new TimeoutManager();
    const fn = vi.fn();

    manager.start('key', 100, fn);

    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('replaces a timeout when start is called with the same key', () => {
    const manager = new TimeoutManager();
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    manager.start('key', 100, fn1);
    manager.start('key', 100, fn2);

    vi.advanceTimersByTime(100);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('clears a pending timeout', () => {
    const manager = new TimeoutManager();
    const fn = vi.fn();

    manager.start('key', 100, fn);
    manager.clear('key');

    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not error when clearing a non-existent key', () => {
    const manager = new TimeoutManager();
    expect(() => manager.clear('nonexistent')).not.toThrow();
  });

  it('clears all active timeouts', () => {
    const manager = new TimeoutManager();
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    manager.start('a', 100, fn1);
    manager.start('b', 200, fn2);
    manager.clearAll();

    vi.advanceTimersByTime(200);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('allows safe clear after a timeout has fired', () => {
    const manager = new TimeoutManager();
    const fn = vi.fn();

    manager.start('key', 100, fn);
    vi.advanceTimersByTime(100);

    expect(() => manager.clear('key')).not.toThrow();
  });
});
