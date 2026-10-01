import type { Page } from '@playwright/test';
import { expect, HMR_CONNECTED_LOG, OVERLAY_ID, test } from '@e2e/helper';

const triggerRuntimeError = async (page: Page, name: string, message: string) => {
  await page.evaluate(
    ({ name, message }) => {
      window.dispatchEvent(
        new CustomEvent('trigger-runtime-error', {
          detail: {
            name,
            message,
          },
        }),
      );
    },
    { name, message },
  );
};

test('should filter runtime errors from overlay', async ({ page, dev, logHelper }) => {
  const { expectLog, addLog } = logHelper;

  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev();
  await expectLog(HMR_CONNECTED_LOG);

  const errorOverlay = page.locator(OVERLAY_ID);
  await expect(errorOverlay).not.toBeAttached();

  await triggerRuntimeError(page, 'AbortError', 'filtered runtime error');
  await expectLog('filtered runtime error');

  await triggerRuntimeError(page, 'TypeError', 'shown runtime error');
  await expectLog('shown runtime error');
  await expect(errorOverlay.locator('.title')).toHaveText('Runtime errors');
  await expect(errorOverlay).toContainText('Uncaught TypeError: shown runtime error');
  await expect(errorOverlay).not.toContainText('filtered runtime error');
});
