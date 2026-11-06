import { expect, test } from '@e2e/helper';

test('generate integrity for async script tags in build', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();

  const content = await rsbuild.getIndexBundle();

  expect(content.includes('sriHashes={') && content.includes('"sha384-')).toBe(true);

  const testEl = page.locator('#root');
  await expect(testEl).toHaveText('foo');
});
