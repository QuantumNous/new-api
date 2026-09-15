import { expect, OVERLAY_ID, test } from '@e2e/helper';

test('should hide Rspack runtime stack when user stack exists', async ({ page, dev }) => {
  await dev();

  const content = page.locator(OVERLAY_ID).locator('.content');

  await expect(content).toContainText('Uncaught Error: Entry runtime error');
  await expect(content).toContainText(/src[\\/]index\.js/);
  await expect(content).not.toContainText('__webpack_require__');
  await expect(content).not.toContainText('webpack/runtime/');
});
