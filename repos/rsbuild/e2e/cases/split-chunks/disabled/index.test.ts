import { expect, test } from '@e2e/helper';

test('should not split chunks if `splitChunks` is disabled', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const jsFiles = Object.keys(files).filter((name) => name.endsWith('.js'));
  expect(jsFiles.length).toEqual(1);
});
