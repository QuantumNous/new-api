import { expect, findFile, test } from '@e2e/helper';

test('should allow plugin to process assets', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const indexJs = findFile(files, 'index.js');

  expect(indexJs).toBeTruthy();
  expect(() => findFile(files, 'index.css')).toThrow();
});
