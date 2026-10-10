import { expect, test } from '@e2e/helper';

test('should print Less plugin hints as expected', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });

  expect(rsbuild.buildError).toBeTruthy();

  await rsbuild.expectLog('To enable support for Less, use "@rsbuild/plugin-less"');
});
