import { expect, test } from '@e2e/helper';

test('should apply resolve.extensions as expected', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      resolve: {
        extensions: ['.ts', '.js'],
      },
    },
  });

  expect(await page.evaluate(() => window.test)).toBe('ts');

  await buildPreview({
    config: {
      resolve: {
        extensions: ['.js', '.ts'],
      },
    },
  });

  expect(await page.evaluate(() => window.test)).toBe('js');
});
