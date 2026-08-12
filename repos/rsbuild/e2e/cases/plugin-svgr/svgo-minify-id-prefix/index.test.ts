import { expect, getFileContent, test } from '@e2e/helper';

test('should add id prefix after svgo minification', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.js');

  expect(content.includes('"linearGradient",{id:"idPrefix_svg__a"')).toBeTruthy();
});
