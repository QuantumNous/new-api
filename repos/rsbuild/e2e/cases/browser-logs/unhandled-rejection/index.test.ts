import { test } from '@e2e/helper';

test('should forward browser unhandled rejection logs to terminal', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog('error   [browser] Uncaught (in promise) 404');
  await rsbuild.expectLog('error   [browser] Uncaught (in promise) false');
  await rsbuild.expectLog('error   [browser] Uncaught (in promise) null');
  await rsbuild.expectLog('error   [browser] Uncaught (in promise) undefined');
  await rsbuild.expectLog('error   [browser] Uncaught (in promise) string');
  await rsbuild.expectLog(
    'error   [browser] Uncaught (in promise) {"name":"Custom","message":"custom message"}',
  );
  await rsbuild.expectLog(
    'error   [browser] Uncaught (in promise) Error: reason (src/index.js:7:0)',
    { posix: true },
  );
  await rsbuild.expectLog('error   [browser] Uncaught (in promise) AbortError: Aborted');
  await rsbuild.expectLog(
    'error   [browser] Uncaught (in promise) Error: Thrown in async (src/index.js:11:0)',
    { posix: true },
  );
  await rsbuild.expectLog(
    'error   [browser] Uncaught (in promise) AbortError: signal is aborted without reason (src/index.js:16:0)',
    { posix: true },
  );
});
