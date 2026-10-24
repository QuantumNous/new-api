import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ test: /\.js$/ }, ({ code }) => {
      return code.replace('__placeholder__', 'without enforce');
    });

    api.transform({ test: /\.js$/, enforce: 'pre' }, ({ code }) => {
      return code.replace('__placeholder__', 'with enforce: pre');
    });
  },
};
