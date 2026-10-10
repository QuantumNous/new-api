import { expect, test } from '@e2e/helper';

test('should compile modules outside of project by default', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });

  expect(rsbuild.buildError).toBeFalsy();
  expect(rsbuild.logs.find((log) => log.includes('Syntax check passed'))).toBeTruthy();
});
