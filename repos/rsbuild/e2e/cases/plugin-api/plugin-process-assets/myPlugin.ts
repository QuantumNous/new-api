import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.processAssets({ stage: 'summarize' }, ({ assets, compilation }) => {
      for (const key of Object.keys(assets)) {
        if (key.endsWith('.css')) {
          compilation.deleteAsset(key);
        }
      }
    });
  },
};
