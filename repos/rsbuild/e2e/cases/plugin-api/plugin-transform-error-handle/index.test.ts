import { test } from '@e2e/helper';

test('should handle transform error in dev', async ({ devOnly }) => {
  const rsbuild = await devOnly();

  await rsbuild.expectLog((log) => log.includes('transform error') && log.includes('Build error'));
});
