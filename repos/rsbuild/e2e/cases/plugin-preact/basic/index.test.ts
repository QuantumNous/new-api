import { expect, test } from '@e2e/helper';

test('should render basic Preact component', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const button = page.locator('#button');
    await expect(button).toHaveText('count: 0');
    await button.click();
    await expect(button).toHaveText('count: 1');
  });
});
