import { expect, OVERLAY_ID, OVERLAY_TITLE_BUILD_FAILED, test } from '@e2e/helper';
import type { Page } from 'playwright';

const expectErrorOverlay = async (page: Page) => {
  await page.waitForSelector(OVERLAY_ID, { state: 'attached' });
  const errorOverlay = page.locator(OVERLAY_ID);
  await expect(errorOverlay.locator('.title')).toHaveText(OVERLAY_TITLE_BUILD_FAILED);
  await expect(errorOverlay).toContainText(
    "TS2322: Type 'string' is not assignable to type 'number'.",
  );
  await expect(errorOverlay.locator('.file-link').first()).toHaveText(
    /^\.(?:.*[\\/])?src[\\/]index\.ts:3:1$/,
  );
};

test('should display type errors on overlay correctly', async ({ page, dev, logHelper }) => {
  const { addLog, expectLog } = logHelper;
  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev();
  await expectLog('TS2322:');
  await expectErrorOverlay(page);

  // The error overlay should be rendered after reloading the page
  page.reload();
  await expectErrorOverlay(page);
});
