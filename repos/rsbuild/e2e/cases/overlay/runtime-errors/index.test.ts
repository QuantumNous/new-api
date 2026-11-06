import { join } from 'node:path';
import { expect, HMR_CONNECTED_LOG, OVERLAY_ID, test } from '@e2e/helper';

test('should show runtime errors on overlay', async ({
  page,
  dev,
  editFile,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  page.on('console', (consoleMessage) => {
    logHelper.addLog(consoleMessage.text());
  });

  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.jsx'),
        },
      },
    },
  });

  await logHelper.expectLog(HMR_CONNECTED_LOG);

  const errorOverlay = page.locator(OVERLAY_ID);
  await expect(errorOverlay.locator('.title')).not.toBeAttached();

  // Introduce a runtime error
  await editFile(join(tempSrc, 'App.jsx'), (code) =>
    code.replace(
      'return <div>Hello</div>',
      `
  throw new Error('Runtime error occurred');
  return <div>Hello</div>`,
    ),
  );
  await logHelper.expectLog('Runtime error occurred');

  // expect overlay to show runtime error
  await expect(errorOverlay.locator('.title')).toHaveText('Runtime errors');
  await expect(errorOverlay.getByText('Uncaught Error: Runtime error occurred')).toBeAttached();

  // expect stack trace to be shown fully
  await expect(errorOverlay.getByText('at App')).toBeAttached();
  await expect(errorOverlay.getByText('at renderWithHooks')).toBeAttached();
});
