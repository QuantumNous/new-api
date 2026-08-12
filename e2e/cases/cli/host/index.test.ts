import { getRandomPort, NETWORK_LOG_REGEX, test } from '@e2e/helper';

test('should listen on localhost by default', async ({ execCli, logHelper }) => {
  const port = await getRandomPort();
  execCli(`dev --port ${port}`);
  await logHelper.expectBuildEnd();
  await logHelper.expectLog(`➜  Local:    http://localhost:${port}`);
  logHelper.expectNoLog(NETWORK_LOG_REGEX);
});

test('should listen on all interfaces when host is true', async ({ execCli, logHelper }) => {
  const port = await getRandomPort();
  execCli(`dev --host --port ${port}`);
  await logHelper.expectBuildEnd();
  await logHelper.expectLog(`➜  Local:    http://localhost:${port}`);
  await logHelper.expectLog(NETWORK_LOG_REGEX);
});

test('should listen on all interfaces when host is 0.0.0.0', async ({ execCli, logHelper }) => {
  const port = await getRandomPort();
  execCli(`dev --host 0.0.0.0 --port ${port}`);
  await logHelper.expectBuildEnd();
  await logHelper.expectLog(`➜  Local:    http://localhost:${port}`);
  await logHelper.expectLog(NETWORK_LOG_REGEX);
});
