import { test } from '@e2e/helper';

// https://github.com/web-infra-dev/rsbuild/pull/6671
test('should print async build warnings in browser console', async ({ page, dev, logHelper }) => {
  const { addLog, expectLog } = logHelper;
  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev();
  await expectLog('TS2322:');
});
