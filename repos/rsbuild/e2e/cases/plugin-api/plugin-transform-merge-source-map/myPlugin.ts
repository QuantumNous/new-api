import { type RsbuildPlugin, rspack } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ test: /\.ts$/, order: 'post' }, async ({ code }) => {
      const result = await rspack.experiments.swc.transform(code, {
        jsc: {
          target: 'es5',
        },
        sourceMaps: true,
      });
      return {
        code: result.code,
        map: result.map,
      };
    });
  },
};
