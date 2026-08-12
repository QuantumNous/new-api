import { expect, getFileContent, test } from '@e2e/helper';
import type { ManifestData } from '@rsbuild/core';

const checkManifestIntegrity = (rsbuild: { getDistFiles: () => Record<string, string> }) => {
  const files = rsbuild.getDistFiles();
  const manifestContent = getFileContent(files, 'manifest.json');
  const manifest = JSON.parse(manifestContent) as ManifestData;

  manifest.allFiles.forEach((item) => {
    if (item.endsWith('.js')) {
      expect(manifest.integrity[item]).toBeTruthy();
    }
  });
};

test('should generate manifest file with integrity', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    checkManifestIntegrity(result);
  });
});

test('should generate manifest file with integrity when html plugin is disabled', async ({
  runBoth,
}) => {
  await runBoth(
    async ({ result }) => {
      checkManifestIntegrity(result);
    },
    {
      config: {
        tools: {
          htmlPlugin: false,
        },
      },
    },
  );
});
