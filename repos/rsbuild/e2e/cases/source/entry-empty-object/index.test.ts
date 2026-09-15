import { expect, test } from '@e2e/helper';

test('should set default entry when entry is set to an empty object', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(filenames.find((item) => item.includes('static/js/index.'))).toBeTruthy();
});
