import { expect, test } from '@e2e/helper';

test('should support options in the new Worker syntax', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#root')).toHaveText('worker:include');
  });
});
