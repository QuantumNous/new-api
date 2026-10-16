import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should generate dnsPrefetch link when dnsPrefetch is defined', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.html');

  expect(content.includes('<link rel="dns-prefetch" href="http://aaaa.com">')).toBeTruthy();
});
