import { join } from 'node:path';
import {
  expect,
  HMR_CONNECTED_LOG,
  OVERLAY_ID,
  OVERLAY_TITLE_BUILD_FAILED,
  test,
} from '@e2e/helper';

test('should filter build errors from overlay', async ({
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

  const errorOverlay = page.locator(OVERLAY_ID);
  await expect(errorOverlay).not.toBeAttached();

  await editFile(
    join(tempSrc, 'App.tsx'),
    () => `import filtered from 'filtered-overlay-error';

const App = () => <div>{filtered}</div>;

export default App;
`,
  );

  await expectLog("Can't resolve 'filtered-overlay-error'");
  await expect(errorOverlay).not.toBeAttached();

  await editFile(
    join(tempSrc, 'App.tsx'),
    () => `import shown from 'shown-overlay-error';

const App = () => <div>{shown}</div>;

export default App;
`,
  );

  await expectLog("Can't resolve 'shown-overlay-error'");
  await expect(errorOverlay.locator('.title')).toHaveText(OVERLAY_TITLE_BUILD_FAILED);
  await expect(errorOverlay).toContainText("Can't resolve 'shown-overlay-error'");
});
