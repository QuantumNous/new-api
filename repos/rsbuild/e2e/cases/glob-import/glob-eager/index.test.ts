import { expect, test } from '@e2e/helper';

test('should import eager modules with import.meta.glob', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#eager-result')).toHaveText('Footer,Header');
  });
});
