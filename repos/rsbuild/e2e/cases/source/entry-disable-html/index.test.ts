import { expect, test } from '@e2e/helper';

test('should disable HTML generation for specific entries', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(filenames.find((item) => item.includes('foo.html'))).toBeTruthy();
  expect(filenames.find((item) => item.includes('bar.html'))).toBeFalsy();
});
