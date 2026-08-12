import { expect, getFileContent, test } from '@e2e/helper';

test('should externalHelpers by default', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const content = getFileContent(files, 'static/js/index.js.map');
  expect(content).toContain('@swc/helpers');
});
