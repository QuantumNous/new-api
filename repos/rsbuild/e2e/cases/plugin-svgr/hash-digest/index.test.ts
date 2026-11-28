import { expect, test } from '@e2e/helper';

// https://github.com/web-infra-dev/rsbuild/issues/4610
test('should generate the same hash digest for the same SVG', async ({ buildPreview }) => {
  const rsbuild = await buildPreview();

  const files = rsbuild.getDistFiles();

  expect(Object.keys(files).filter((key) => key.endsWith('.svg')).length).toEqual(1);
});
