import { expect, getFileContent, test } from '@e2e/helper';

test('should generate integrity attributes in build with native html plugin', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(html).toMatch(/<script crossorigin defer integrity="sha384-[A-Za-z0-9+/=]+"/);
  expect(html).toMatch(
    /link crossorigin href="\/static\/css\/index\.\w{10}\.css" integrity="sha384-[A-Za-z0-9+/=]+"/,
  );

  const testEl = page.locator('#root');
  await expect(testEl).toHaveText('Hello Rsbuild!');
});

test('should generate integrity attributes in dev with native html plugin', async ({
  page,
  dev,
}) => {
  await dev();

  const testEl = page.locator('#root');
  await expect(testEl).toHaveText('Hello Rsbuild!');

  expect(
    await page.evaluate('document.querySelector("script")?.getAttribute("integrity")'),
  ).toBeTruthy();
});
