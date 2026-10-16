import { expect, test } from '@e2e/helper';

test('should apply multiple dist path correctly', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(filenames.some((filename) => filename.includes('dist/static/js/index.js'))).toBeTruthy();
  expect(
    filenames.some((filename) => filename.includes('dist/web1/static/js/index.js')),
  ).toBeTruthy();
});
