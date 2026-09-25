import { expect, vi } from 'vitest';
import { mergeCleanups } from './mergeCleanups';

describe('mergeCleanups', () => {
  it('calls each cleanup in order and skips empty values', () => {
    const first = vi.fn();
    const second = vi.fn();

    mergeCleanups(first, undefined, false, null, second)();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.invocationCallOrder[0]).toBeLessThan(second.mock.invocationCallOrder[0]);
  });
});
