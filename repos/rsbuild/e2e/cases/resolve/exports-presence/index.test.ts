import { expect, test } from '@e2e/helper';

test('should detect and report missing named export errors during build', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });

  expect(rsbuild.buildError).toBeTruthy();
  await rsbuild.expectLog(`export 'aa' (imported as 'aa') was not found in './test'`);
});

test('should detect and report missing named export errors in dev', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog(`export 'aa' (imported as 'aa') was not found in './test'`);
});
