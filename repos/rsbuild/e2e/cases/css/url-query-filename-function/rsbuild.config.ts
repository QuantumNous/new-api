import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filenameHash: false,
    filename: {
      css(_pathData, assetInfo) {
        if (assetInfo?.sourceFilename === 'src/style.css') {
          return 'from-asset-info/[name].css';
        }

        return '[name].css';
      },
    },
  },
});
