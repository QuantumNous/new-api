import { test } from '@e2e/helper';

const EXPECTED_LOG = 'error   [browser] Uncaught Error: test (src/index.js:1:0)';

test('should forward browser error logs to terminal by default', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog(EXPECTED_LOG, { posix: true });
});

test('should disable forwarding browser error logs', async ({ dev }) => {
  const rsbuild = await dev({
    config: {
      dev: {
        browserLogs: false,
      },
    },
  });
  rsbuild.expectNoLog(EXPECTED_LOG, { posix: true });
});
