import { expect, test } from '@e2e/helper';

test('should allow to disable the default `lib-polyfill` cache group', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const jsFiles = Object.keys(files).filter((name) => name.endsWith('.js'));
  expect(jsFiles.find((file) => file.includes('lib-polyfill'))).toBeFalsy();
});
