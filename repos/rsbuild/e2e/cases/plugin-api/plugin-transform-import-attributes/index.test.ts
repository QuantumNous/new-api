import { expect, test } from '@e2e/helper';

test('should allow plugin to transform code with import attributes', async ({ build }) => {
  const rsbuild = await build();
  const indexJs = await rsbuild.getIndexBundle();
  expect(indexJs).toContain('with import attributes');
});
