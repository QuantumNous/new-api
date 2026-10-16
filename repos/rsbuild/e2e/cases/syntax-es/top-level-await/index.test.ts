import { expect, test } from '@e2e/helper';

test('should run top level await correctly', async ({ page, buildPreview }) => {
  await buildPreview();

  expect(await page.evaluate('window.foo')).toEqual('hello');
});
