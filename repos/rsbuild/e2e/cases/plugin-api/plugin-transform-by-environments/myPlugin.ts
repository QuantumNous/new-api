import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ test: /\.js$/, environments: ['web'] }, ({ code, environment }) => {
      return {
        code: code.replace('hello', `environments is ${environment.name}`),
      };
    });
    api.transform({ test: /\.js$/, environments: ['node'] }, ({ code, environment }) => {
      return {
        code: code.replace('hello', `environments is ${environment.name}`),
      };
    });
  },
};
