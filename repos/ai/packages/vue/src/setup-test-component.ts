import { cleanup, render } from '@testing-library/vue';
import { beforeEach, afterEach, vi } from 'vitest';

export const setupTestComponent = (
  TestComponent: any,
  {
    init,
  }: {
    init?: (TestComponent: any) => any;
  } = {},
) => {
  beforeEach(() => {
    render(init?.(TestComponent) ?? TestComponent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  return TestComponent;
};
