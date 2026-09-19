import { expect, test } from '@e2e/helper';

test('should build React and Solid plugins in different environments', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();

  const reactUrl = new URL(`http://localhost:${rsbuild.port}/react`);

  await page.goto(reactUrl.href);

  await expect(page.locator('#test')).toHaveText('Hello Rsbuild!');

  const solidUrl = new URL(`http://localhost:${rsbuild.port}/solid`);

  await page.goto(solidUrl.href);

  const button = page.locator('#button');
  await expect(button).toHaveText('count: 0');

  await button.click();
  await expect(button).toHaveText('count: 1');
});
