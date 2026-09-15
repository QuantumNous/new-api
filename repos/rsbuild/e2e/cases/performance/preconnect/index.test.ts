import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should generate preconnect link when preconnect is defined', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.html');

  expect(content.includes('<link rel="preconnect" href="http://aaaa.com">')).toBeTruthy();

  expect(
    content.includes('<link rel="preconnect" href="http://bbbb.com" crossorigin>'),
  ).toBeTruthy();
});
