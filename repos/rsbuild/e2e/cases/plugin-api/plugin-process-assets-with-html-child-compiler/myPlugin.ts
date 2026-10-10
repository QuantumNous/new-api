import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    let count = 0;
    api.processAssets({ stage: 'summarize' }, ({ assets, compilation }) => {
      count++;

      if (count > 1) {
        throw new Error('processAssets callback should only called once');
      }

      for (const key of Object.keys(assets)) {
        if (key.endsWith('.css')) {
          compilation.deleteAsset(key);
        }
      }
    });
  },
};
