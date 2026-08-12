import { expect, test } from '@e2e/helper';

test('should support import attributes syntax', async ({ build }) => {
  const rsbuild = await build();
  const indexJs = await rsbuild.getIndexBundle();
  expect(indexJs).toContain('with import attributes');
});
