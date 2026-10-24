import { expect, test } from '@e2e/helper';

test('should not print file size if has errors', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });
  expect(rsbuild.buildError).toBeTruthy();
  rsbuild.expectNoLog('Total:');
});
