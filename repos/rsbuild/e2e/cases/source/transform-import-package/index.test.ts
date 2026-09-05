import { expect, test } from '@e2e/helper';

test('should support transformImport for CommonJS packages', async ({ build, copyNodeModules }) => {
  await copyNodeModules();

  const rsbuild = await build();
  const content = await rsbuild.getIndexBundle();

  expect(content).toContain('transformImport test succeed');
  expect(content).not.toContain('unused debounce should not be bundled');
});
