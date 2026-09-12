import { expect, test } from '@e2e/helper';

test('should exclude specified Sass files using addExcludes', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  const scssFiles = Object.keys(files).filter((file) => file.endsWith('.scss'));

  expect(scssFiles.length).toBe(1);
  expect(cssFiles.length).toBe(1);
});
