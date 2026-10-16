import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ test: /\.js$/ }, ({ code }) => {
      return code.replace('__placeholder__', 'without order');
    });

    api.transform({ test: /\.js$/, order: 'pre' }, ({ code }) => {
      return code.replace('__placeholder__', 'with order: pre');
    });
  },
};
