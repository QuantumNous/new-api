import { expect, vi } from 'vitest';
import { addEventListener } from './addEventListener';

describe('addEventListener', () => {
  it('adds the listener and returns an unsubscribe function', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const listener = vi.fn();
    const options = { capture: true, passive: false };

    const unsubscribe = addEventListener(target, 'click', listener, options);

    expect(target.addEventListener).toHaveBeenCalledWith('click', listener, options);

    unsubscribe();

    expect(target.removeEventListener).toHaveBeenCalledWith('click', listener, options);
  });
});
