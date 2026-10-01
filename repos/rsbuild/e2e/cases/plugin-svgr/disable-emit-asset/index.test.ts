import { expect, test } from '@e2e/helper';

test('should import svg with SVGR plugin and query URL correctly', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(filenames.some((filename) => filename.includes('dist/static/svg/mobile.svg'))).toBeFalsy();
});
