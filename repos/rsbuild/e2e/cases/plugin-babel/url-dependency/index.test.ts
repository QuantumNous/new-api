import { expect, test } from '@e2e/helper';
import { pluginBabel } from '@rsbuild/plugin-babel';

test('should keep URL dependency assets unchanged with Babel include', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      output: {
        filenameHash: false,
      },
      plugins: [pluginBabel({ include: /src/ })],
    },
  });

  const files = rsbuild.getDistFiles();
  const asset = Object.keys(files).find((filename) =>
    filename.includes('dist/static/assets/asset.ts'),
  );

  expect(asset).toBeDefined();
  expect(files[asset!]).toContain(`export const value: string = 'url dependency';`);
  expect(await page.evaluate('window.assetUrl')).toBe(
    `http://localhost:${rsbuild.port}/static/assets/asset.ts`,
  );
});
