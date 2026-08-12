import { expect, getFileContent, test } from '@e2e/helper';

const getClassName = (content: string, localName: string) => {
  const matched = content.match(new RegExp(`${localName}-[\\w-]{6}`));
  expect(matched).toBeTruthy();
  return matched![0];
};

test('should keep CSS Modules identifiers consistent between web and node targets', async ({
  build,
}) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const clientCss = getFileContent(
    files,
    (file) => file.includes('/web/') && file.endsWith('.css'),
  );
  const serverJs = getFileContent(
    files,
    (file) => file.includes('/node/') && file.endsWith('/index.js'),
  );

  expect(getClassName(serverJs, 'red')).toBe(getClassName(clientCss, 'red'));
  expect(getClassName(serverJs, 'blue')).toBe(getClassName(clientCss, 'blue'));
});
