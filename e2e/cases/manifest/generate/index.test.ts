import { expect, getFileContent, test } from '@e2e/helper';
import type { RsbuildConfig } from '@rsbuild/core';

const config: RsbuildConfig = {
  output: {
    manifest: {
      filename: 'my-manifest.json',
      generate: ({ files, manifestData }) => {
        return {
          filesCount: files.length,
          data: manifestData,
        };
      },
    },
    sourceMap: false,
    filenameHash: false,
  },
  splitChunks: false,
};

test('should generate custom manifest data', async ({ runBoth }) => {
  await runBoth(
    async ({ result }) => {
      const files = result.getDistFiles();
      const manifestContent = getFileContent(files, 'my-manifest.json');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.filesCount).toBe(2);
      expect(manifest.data.allFiles.length).toBe(2);
      expect(manifest.data.entries.index).toMatchObject({
        initial: {
          js: ['/static/js/index.js'],
        },
        html: ['/index.html'],
      });
    },
    {
      config,
    },
  );
});
