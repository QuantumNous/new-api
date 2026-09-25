import { test } from '@e2e/helper';

test('should not print deprecation logs', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    await result.expectBuildEnd();
    result.expectNoLog(/deprecated|deprecation/i);
  });
});
