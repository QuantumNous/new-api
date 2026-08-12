import { expect, test } from '@e2e/helper';

test('should add single environment plugin correctly', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();

  const button = page.locator('#test');
  await expect(button).toHaveText('Hello Rsbuild!');

  const web1Url = new URL(`http://localhost:${rsbuild.port}/web1/main`);

  await page.goto(web1Url.href);

  await expect(page.locator('#test1')).toHaveText('Hello Rsbuild!');

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(
    filenames.some((filename) => filename.includes('dist/static/js/lib-react.js')),
  ).toBeTruthy();
  expect(
    filenames.some((filename) => filename.includes('dist/web1/static/js/lib-react.js')),
  ).toBeFalsy();
});
