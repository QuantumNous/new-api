import { expect, gotoPage, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should handle relative paths correctly for multiple entries in subdirectories', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();

  const entries = [
    {
      entry: 'index',
      filename: 'index.html',
      pathname: '/index.html',
      src: 'test.js',
    },
    {
      entry: 'subdir/main',
      filename: 'subdir/main.html',
      pathname: '/subdir/main.html',
      src: '../test.js',
    },
    {
      entry: 'subdir/test',
      filename: 'subdir/test.html',
      pathname: '/subdir/test.html',
      src: '../test.js',
    },
  ];

  for (const { filename, src } of entries) {
    const html = getFileContent(files, filename);
    expect(html).toContain(`src="${src}"`);
  }

  for (const { entry, pathname } of entries) {
    await gotoPage(page, rsbuild, entry);
    expect(await page.evaluate('window.__htmlTagTest')).toEqual({
      loaded: true,
      pathname,
    });
  }
});
