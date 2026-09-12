import { expect, test } from '@e2e/helper';

test('should support custom dist paths for different file types', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  // JS
  expect(
    filenames.some((filename) => filename.includes('dist/custom/my-js/index.js')),
  ).toBeTruthy();
  expect(
    filenames.some((filename) => filename.includes('dist/custom/my-async-js/foo.js')),
  ).toBeTruthy();

  // CSS
  expect(
    filenames.some((filename) => filename.includes('dist/custom/my-css/index.css')),
  ).toBeTruthy();
  expect(
    filenames.some((filename) => filename.includes('dist/custom/my-async-css/foo.css')),
  ).toBeTruthy();

  // HTML
  expect(
    filenames.some((filename) => filename.includes('dist/custom/my-html/index.html')),
  ).toBeTruthy();

  // Image
  expect(
    filenames.some((filename) => filename.includes('dist/custom/my-image/icon.png')),
  ).toBeTruthy();
});
