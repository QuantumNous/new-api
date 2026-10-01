import { test } from '@e2e/helper';

test('should hide Rspack runtime stack frame when non-runtime stack exists', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog('[browser] Uncaught Error: foo');
  rsbuild.expectNoLog(/__webpack_require__|webpack\/runtime\//);
});
