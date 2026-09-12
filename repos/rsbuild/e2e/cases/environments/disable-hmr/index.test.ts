import { expect, test } from '@e2e/helper';

test('should allow to disable HMR and live reload for a specified environment', async ({
  devOnly,
}) => {
  const rsbuild = await devOnly();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  const fooJs = filenames.find((filename) => filename.includes('dist/static/js/foo.js'));
  const barJs = filenames.find((filename) => filename.includes('dist/static/js/bar.js'));
  const fooContent = files[fooJs!];
  const barContent = files[barJs!];

  expect(fooContent.includes('dist/client/hmr.js')).toBeTruthy();
  expect(barContent.includes('dist/client/hmr.js')).toBeFalsy();
});
