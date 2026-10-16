import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.processAssets({ stage: 'summarize', targets: ['web'] }, ({ assets, compilation }) => {
      for (const key of Object.keys(assets)) {
        if (key.endsWith('.js')) {
          compilation.deleteAsset(key);
        }
      }
    });
  },
};
