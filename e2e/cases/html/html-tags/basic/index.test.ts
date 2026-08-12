import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should inject tags correctly', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();

  const indexHtml = getFileContent(files, 'index.html');

  expect(indexHtml.includes('<script src="/foo.js"></script>')).toBeTruthy();
  expect(indexHtml.includes('<script src="https://www.cdn.com/foo.js"></script>')).toBeTruthy();
  expect(indexHtml.includes('<meta name="referrer" content="origin">')).toBeTruthy();
  expect(indexHtml.includes('<link ref="preconnect" href="https://example.com">')).toBeTruthy();
});
