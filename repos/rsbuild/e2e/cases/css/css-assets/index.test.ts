import { expect, test } from '@e2e/helper';

test('should build CSS assets correctly', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(
    filenames.find((item) => item.includes('static/image/image') && item.endsWith('.jpeg')),
  ).toBeTruthy();
});
