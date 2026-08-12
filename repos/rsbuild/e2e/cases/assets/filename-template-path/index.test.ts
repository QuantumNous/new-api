import { expect, test } from '@e2e/helper';

test('should allow filename.image: "[path]"', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);
  // Image
  expect(filenames.some((filename) => filename.includes('dist/src/assets/icon.png'))).toBeTruthy();
});
