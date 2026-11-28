import { test } from '@e2e/helper';

test('should support calling `close()` multiple times', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    await result.close();
    await result.close();
  });
});
