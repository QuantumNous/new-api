import { expect, test } from '@e2e/helper';

test('should print Sass plugin hints as expected', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });

  expect(rsbuild.buildError).toBeTruthy();
  await rsbuild.expectLog('To enable support for Sass, use "@rsbuild/plugin-sass"');
});
