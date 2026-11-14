import { expect, test } from '@e2e/helper';
import { toPosixPath } from '@rstackjs/test-utils';

test('should not compile specified file when source.exclude', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });

  expect(rsbuild.buildError).toBeTruthy();
  expect(rsbuild.logs.find((log) => log.includes('ERROR 1'))).toBeTruthy();
  expect(
    rsbuild.logs.find(
      (log) => log.includes('source:') && toPosixPath(log).includes('/dist/static/js/index'),
    ),
  ).toBeTruthy();
});
