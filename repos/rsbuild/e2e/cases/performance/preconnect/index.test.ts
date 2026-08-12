import { expect, getFileContent, test } from '@e2e/helper';

test('should generate preconnect link when preconnect is defined', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.html');

  expect(content.includes('<link rel="preconnect" href="http://aaaa.com">')).toBeTruthy();

  expect(
    content.includes('<link rel="preconnect" href="http://bbbb.com" crossorigin>'),
  ).toBeTruthy();
});
