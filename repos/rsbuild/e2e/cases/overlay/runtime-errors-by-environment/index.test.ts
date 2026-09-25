import { expect, gotoPage, HMR_CONNECTED_LOG, OVERLAY_ID, test } from '@e2e/helper';

test('should allow to set different dev.client.overlay.runtime for multiple environments', async ({
  page,
  devOnly,
  logHelper,
}) => {
  const { expectLog, addLog } = logHelper;
  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  const rsbuild = await devOnly();

  await gotoPage(page, rsbuild, 'foo');
  await expectLog(HMR_CONNECTED_LOG);
  await expect(page.locator(OVERLAY_ID).locator('.title')).toHaveText('Runtime errors');

  logHelper.clearLogs();
  await gotoPage(page, rsbuild, 'bar');
  await expectLog(HMR_CONNECTED_LOG);
  await expect(page.locator(OVERLAY_ID)).not.toBeAttached();
});
