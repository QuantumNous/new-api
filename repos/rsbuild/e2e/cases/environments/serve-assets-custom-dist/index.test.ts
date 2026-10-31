import { expect, test } from '@e2e/helper';

test('serve multiple environments correctly when distPaths are different', async ({
  dev,
  page,
}) => {
  const rsbuild = await dev();

  await page.goto(`http://localhost:${rsbuild.port}/web1/`);
  await expect(page.locator('#test')).toHaveText('web1');

  await page.goto(`http://localhost:${rsbuild.port}/web2/`);
  await expect(page.locator('#test')).toHaveText('web2');

  await page.goto(`http://localhost:${rsbuild.port}/`);
  await expect(page.locator('#test')).toHaveText('web1');
});
