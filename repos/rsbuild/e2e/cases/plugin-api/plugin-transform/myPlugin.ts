import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ test: /\.css$/ }, ({ code }) => {
      return code.replace('red', 'blue');
    });

    api.transform({ test: /\.js$/ }, ({ code, emitFile }) => {
      emitFile('static/hello.txt', 'hello world');
      return {
        code: code.replace('hello', 'world'),
      };
    });
  },
};
