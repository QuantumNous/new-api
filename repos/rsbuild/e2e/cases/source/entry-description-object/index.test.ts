import { expect, test } from '@e2e/helper';

test('should support configuring an entry description object', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(filenames.find((item) => item.includes('static/js/foo.'))).toBeTruthy();
  expect(filenames.find((item) => item.includes('static/js/bar.'))).toBeTruthy();
});
