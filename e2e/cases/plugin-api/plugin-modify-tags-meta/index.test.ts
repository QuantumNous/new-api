import { expect, getFileContent, test } from '@e2e/helper';

test('should allow plugin to modify HTML tags with metadata', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(
    html.includes('<script src="https://example.com/script.js" id="foo"></script>'),
  ).toBeTruthy();
});
