import { expect, test } from '@e2e/helper';

test('should serve multiple environments correctly', async ({ dev, page }) => {
  const rsbuild = await dev({
    config: {
      environments: {
        web: {},
        web1: {
          dev: {
            // When generating outputs for multiple web environments,
            // if assetPrefix is not added, file search conflicts will occur.
            assetPrefix: 'auto',
          },
          source: {
            entry: {
              main: './src/web1.js',
            },
          },
          output: {
            distPath: {
              root: 'dist/web1',
              html: 'html1',
            },
          },
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);
  await expect(page.locator('#test')).toHaveText('Hello Rsbuild!');

  await page.goto(`http://localhost:${rsbuild.port}/web1/html1/main`);
  await expect(page.locator('#test')).toHaveText('Hello Rsbuild (web1)!');
});
