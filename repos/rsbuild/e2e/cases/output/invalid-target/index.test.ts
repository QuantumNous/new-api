import { expect, test } from '@e2e/helper';

test('should throw error when `output.target` is invalid', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });

  expect(rsbuild.buildError?.message).toContain(
    `Invalid value of output.target: "foo", valid values are:`,
  );
});
