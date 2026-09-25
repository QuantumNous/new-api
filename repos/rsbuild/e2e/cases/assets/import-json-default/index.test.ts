import { expect, test } from '@e2e/helper';

test('should import JSON with default import and tree shake unused properties', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();
  const content = await rsbuild.getIndexBundle();
  expect(content.includes('foo')).toBeFalsy();
  expect(content.includes('list')).toBeFalsy();
  expect(content.includes('window.testValue=20')).toBeTruthy();
  expect(await page.evaluate('window.testValue')).toBe(20);
});
