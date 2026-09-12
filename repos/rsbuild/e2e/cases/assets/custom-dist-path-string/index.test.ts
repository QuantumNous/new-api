import { expect, test } from '@e2e/helper';

test('should set `output.distPath` to a string', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);
  expect(
    filenames.some((filename) => filename.includes('dist-custom/static/js/index.js')),
  ).toBeTruthy();
});
