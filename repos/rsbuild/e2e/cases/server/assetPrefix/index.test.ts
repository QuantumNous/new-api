import { expect, test } from '@e2e/helper';

test('should match resource correctly with specify assetPrefix', async ({ page, dev }) => {
  await dev({
    config: {
      dev: {
        assetPrefix: '/subpath/',
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should match resource correctly with full url assetPrefix', async ({ page, dev }) => {
  await dev({
    config: {
      dev: {
        assetPrefix: `http://localhost:<port>/subpath/`,
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});
