import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.resolve(({ resolveData }) => {
      if (resolveData.request === './a.js') {
        resolveData.request = './b.js';
      }
    });
  },
};
