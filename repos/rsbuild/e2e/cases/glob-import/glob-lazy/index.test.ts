import { expect, test } from '@e2e/helper';

test('should import lazy modules with import.meta.glob', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#lazy-result')).toHaveText('Footer,Header');
  });
});
