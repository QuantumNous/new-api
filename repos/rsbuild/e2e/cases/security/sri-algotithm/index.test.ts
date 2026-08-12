import { expect, getFileContent, test } from '@e2e/helper';

test('generate integrity using sha512 algorithm', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();

  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(html).toMatch(
    /<script defer src="\/static\/js\/index\.\w{10}\.js" integrity="sha512-[A-Za-z0-9+/=]+"/,
  );

  expect(html).toMatch(
    /link href="\/static\/css\/index\.\w{10}\.css" rel="stylesheet" integrity="sha512-[A-Za-z0-9+/=]+"/,
  );

  const testEl = page.locator('#root');
  await expect(testEl).toHaveText('Hello Rsbuild!');
});
