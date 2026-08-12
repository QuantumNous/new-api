import { expect, getFileContent, test } from '@e2e/helper';

test('should generate dnsPrefetch link when dnsPrefetch is defined', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.html');

  expect(content.includes('<link rel="dns-prefetch" href="http://aaaa.com">')).toBeTruthy();
});
