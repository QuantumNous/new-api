import { expect, getRandomPort, gotoPage, test } from '@e2e/helper';

test('should run dev server via `dev` command', async ({ page, execCli, logHelper }) => {
  const port = await getRandomPort();
  execCli(`dev --port ${port}`);
  await logHelper.expectBuildEnd();
  await gotoPage(page, { port });
  await expect(page.locator('#test')).toHaveText('hello');
});

test('should run dev server via no command', async ({ page, execCli, logHelper }) => {
  const port = await getRandomPort();
  execCli(`--port ${port}`);
  await logHelper.expectBuildEnd();
  await gotoPage(page, { port });
  await expect(page.locator('#test')).toHaveText('hello');
});
