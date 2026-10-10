import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ test: /\.css$/ }, ({ code }) => {
      return Buffer.from(code.replace('red', 'blue'));
    });

    api.transform({ test: /\.js$/ }, ({ code }) => {
      return {
        code: Buffer.from(code.replace('hello', 'world')),
      };
    });
  },
};
