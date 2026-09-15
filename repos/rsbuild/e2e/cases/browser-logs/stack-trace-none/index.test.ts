import { test } from '@e2e/helper';

const EXPECTED_LOG = 'error   [browser] Uncaught Error: test';

test('should hide stack trace when stackTrace is none', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog(EXPECTED_LOG, { posix: true, strict: true });
});
