import { expect, test } from '@e2e/helper';

test('should work with the default writeToDisk configuration', async ({ page, dev }) => {
  await dev({
    config: {
      output: {
        distPath: 'dist-write-to-disk-default',
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should work when writeToDisk is set to false', async ({ page, dev }) => {
  await dev({
    config: {
      output: {
        distPath: 'dist-write-to-disk-false',
      },
      dev: {
        writeToDisk: false,
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should work when writeToDisk is set to true', async ({ page, dev }) => {
  await dev({
    config: {
      output: {
        distPath: 'dist-write-to-disk',
      },
      dev: {
        writeToDisk: true,
      },
    },
  });

  const test = page.locator('#test');
  await expect(test).toHaveText('Hello Rsbuild!');
});
