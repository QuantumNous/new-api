import { join } from 'node:path';
import { expect, MODULE_BUILD_FAILED_LOG, OVERLAY_ID, test } from '@e2e/helper';

test('should hide overlay after resolving error', async ({
  page,
  dev,
  editFile,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.jsx'),
        },
      },
    },
  });

  await editFile(join(tempSrc, 'App.jsx'), (code) => code.replace('</div>', '</a>'));
  await logHelper.expectLog(MODULE_BUILD_FAILED_LOG);
  await expect(page.locator(OVERLAY_ID)).toBeAttached();

  logHelper.clearLogs();
  await editFile(join(tempSrc, 'App.jsx'), (code) => code.replace('</a>', '</div>'));
  await logHelper.expectBuildEnd();
  await expect(page.locator(OVERLAY_ID)).not.toBeAttached();
});
