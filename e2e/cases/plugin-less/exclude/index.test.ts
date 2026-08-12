import { expect, test } from '@e2e/helper';

test('should exclude specified Less files using the exclude option', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  const lessFiles = Object.keys(files).filter((file) => file.endsWith('.less'));

  expect(lessFiles.length).toBe(1);
  expect(cssFiles.length).toBe(1);
});
