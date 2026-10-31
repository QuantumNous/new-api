import { expect, test } from '@playwright/test';

test.describe('setValue with react native or web', () => {
  test('should only trigger re-render when form state changed or error triggered', async ({
    page,
  }) => {
    await page.goto('/setValueCustomRegister');
    await expect(page.locator('#dirty')).toContainText('false');
    await page.locator('#TriggerDirty').click();
    await expect(page.locator('#dirty')).toContainText('true');
    await page.locator('#TriggerNothing').click();
    await page.locator('#TriggerNothing').click();
    await page.locator('#TriggerNothing').click();
    await page.locator('#TriggerNothing').click();

    await page.locator('#WithError').click();
    await page.locator('#WithError').click();

    await page.locator('#WithoutError').click();
    await page.locator('#WithoutError').click();

    await page.locator('#WithError').click();

    await page.locator('#TriggerNothing').click();
    await expect(page.locator('#renderCount')).toContainText('8');
  });
});
