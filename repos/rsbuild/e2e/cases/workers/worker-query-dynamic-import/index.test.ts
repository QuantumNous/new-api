import { expect, test } from '@e2e/helper';

test('should support dynamic imports inside worker query imports', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    await expect(page.locator('#worker')).toHaveText('a:b');
  });
});
