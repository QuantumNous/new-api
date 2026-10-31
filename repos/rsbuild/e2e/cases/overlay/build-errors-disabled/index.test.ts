import { join } from 'node:path';
import { expect, HMR_CONNECTED_LOG, MODULE_BUILD_FAILED_LOG, OVERLAY_ID, test } from '@e2e/helper';

test('should allow disabling build error overlay independently', async ({
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
          index: join(tempSrc, 'index.jsx'),
        },
      },
    },
  });

  await expectLog(HMR_CONNECTED_LOG);

  const errorOverlay = page.locator(OVERLAY_ID);
  await expect(errorOverlay).not.toBeAttached();

  await editFile(join(tempSrc, 'App.jsx'), (code) => code.replace('</div>', '</a>'));

  await expectLog(MODULE_BUILD_FAILED_LOG);
  await expect(errorOverlay).not.toBeAttached();

  await editFile(
    join(tempSrc, 'App.jsx'),
    () => `const App = () => {
  throw new Error('Runtime error with build error overlay disabled');
  return <div>Hello</div>;
};

export default App;
`,
  );

  await expectLog('Runtime error with build error overlay disabled');
  await expect(errorOverlay.locator('.title')).toHaveText('Runtime errors');
});
