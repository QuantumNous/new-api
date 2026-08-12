import { expect, test } from '@e2e/helper';

test('should support entry import array', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#app')).toHaveText('first,second');
  });
});
