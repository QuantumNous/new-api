import { MODULE_BUILD_FAILED_LOG, test } from '@e2e/helper';

test('should skip browser error logs if build failed', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog(MODULE_BUILD_FAILED_LOG);
  rsbuild.expectNoLog('[browser]');
});
