import { expect, test } from '@e2e/helper';

test('should not polyfill dirname and filename in web target when output.module is enabled', async ({
  page,
  buildPreview,
}) => {
  await buildPreview();
  const values = await page.evaluate('window.testValues');
  expect(values).toEqual({
    dirname: 'undefined',
    filename: 'undefined',
    importMetaDirname: 'undefined',
    importMetaFilename: 'undefined',
  });
});
