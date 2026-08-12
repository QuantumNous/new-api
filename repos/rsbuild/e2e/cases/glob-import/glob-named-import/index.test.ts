import { expect, test } from '@e2e/helper';

test('should import named exports with import.meta.glob', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#named-import-result')).toHaveText('footer-label,header-label');
  });
});
