import { expect, getFileContent, test } from '@e2e/helper';

test('should allow to inject tags by entry name', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const fooHTML = getFileContent(files, 'foo.html');
  expect(fooHTML.match(/src="https:\/\/www\.cdn\.com\/foo\.js/)).toBeTruthy();

  const barHTML = getFileContent(files, 'bar.html');
  expect(barHTML.match(/src="https:\/\/www\.cdn\.com\/bar\.js/)).toBeTruthy();
});
