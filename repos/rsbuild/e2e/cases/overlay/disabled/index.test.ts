import { join } from 'node:path';
import { expect, HMR_CONNECTED_LOG, MODULE_BUILD_FAILED_LOG, OVERLAY_ID, test } from '@e2e/helper';

test('should disable error overlay when dev.client.overlay is false', async ({
  page,
  dev,
  editFile,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const { expectLog, addLog } = logHelper;

  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.tsx'),
        },
      },
    },
  });

  await expectLog(HMR_CONNECTED_LOG);

  await expect(page.locator(OVERLAY_ID)).not.toBeAttached();

  await editFile(join(tempSrc, 'App.tsx'), (code) => code.replace('</div>', '</a>'));

  await expectLog(MODULE_BUILD_FAILED_LOG);
  await expect(page.locator(OVERLAY_ID)).not.toBeAttached();
});
