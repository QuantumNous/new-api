import { test } from '@e2e/helper';

// Omitted some parts of the stack trace as they are not static
const EXPECTED_LOG = `error   [browser] Uncaught Error: foo
    at foo (src/foo.js:2:0)
    at src/index.js:3:0`;

test('should display formatted full stack trace', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog(EXPECTED_LOG, { posix: true });
});
