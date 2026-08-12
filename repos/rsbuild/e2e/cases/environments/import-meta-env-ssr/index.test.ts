import { expect, getFileContent, test } from '@e2e/helper';

test('should define import.meta.env.SSR based on environment target', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const webBundle = getFileContent(files, 'dist/static/js/index.js');
  const nodeBundle = getFileContent(files, 'dist/node/index.js');

  expect(webBundle).toContain('"SSR":false');
  expect(webBundle).toContain("console.log('direct SSR:', false);");
  expect(webBundle).toContain("console.log('destructured SSR:', SSR);");

  expect(nodeBundle).toContain('const directSSR = true;');
  expect(nodeBundle).toContain('"SSR":true');
  expect(nodeBundle).toContain("console.log('direct SSR:', true);");
  expect(nodeBundle).toContain("console.log('destructured SSR:', SSR);");
});
