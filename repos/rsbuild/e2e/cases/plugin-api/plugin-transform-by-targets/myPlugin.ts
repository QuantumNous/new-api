import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ test: /\.js$/, targets: ['web'] }, ({ code }) => {
      return {
        code: code.replace('hello', 'target is web'),
      };
    });
    api.transform({ test: /\.js$/, targets: ['node'] }, ({ code }) => {
      return {
        code: code.replace('hello', 'target is node'),
      };
    });
  },
};
