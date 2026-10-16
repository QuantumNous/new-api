import { describe, expect, it } from 'vitest';
import { isBrowserRuntime } from './is-browser-runtime';

describe('isBrowserRuntime', () => {
  it('returns true when a global window is present', () => {
    expect(isBrowserRuntime({ window: {} })).toBe(true);
  });

  it('returns false when there is no window (server runtimes)', () => {
    expect(isBrowserRuntime({})).toBe(false);
    expect(isBrowserRuntime({ window: undefined })).toBe(false);
    expect(isBrowserRuntime({ process: { versions: { node: '22' } } })).toBe(
      false,
    );
  });
});
