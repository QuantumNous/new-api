import { expect, test } from '@e2e/helper';

test('should allow to set alias by build target', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const fileNames = Object.keys(files);
  const webIndex = fileNames.find(
    (file) => file.includes('static/js') && file.endsWith('index.js'),
  );
  const nodeIndex = fileNames.find(
    (file) => file.includes('server/index') && file.endsWith('index.js'),
  );

  expect(files[webIndex!]).toContain('for web target');
  expect(files[nodeIndex!]).toContain('for node target');
});
