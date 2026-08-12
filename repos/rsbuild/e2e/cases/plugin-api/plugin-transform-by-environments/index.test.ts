import { expect, getFileContent, test } from '@e2e/helper';

test('should allow plugin to transform code by environments', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const webJs = getFileContent(files, 'static/js/index.js');
  const nodeJs = getFileContent(files, 'server/index.js');

  expect(webJs.includes('environments is web')).toBeTruthy();
  expect(nodeJs.includes('environments is node')).toBeTruthy();
});
