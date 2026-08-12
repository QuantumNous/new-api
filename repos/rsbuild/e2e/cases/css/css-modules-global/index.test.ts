import { expect, getFileContent, test } from '@e2e/helper';

test('should compile CSS Modules with :global() correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');
  expect(content).toMatch(
    /.*\{position:relative\}.* \.bar,.* \.baz\{height:100%;overflow:hidden\}.* \.lol{width:80%}/,
  );
});
