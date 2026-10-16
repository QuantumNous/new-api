import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ with: { type: 'json' } }, () => {
      return JSON.stringify({ type: 'with import attributes' });
    });
  },
};
