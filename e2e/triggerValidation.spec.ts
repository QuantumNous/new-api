import { expect, test } from '@playwright/test';

test.describe('form trigger', () => {
  test('should trigger input validation', async ({ page }) => {
    await page.goto('/trigger-validation');

    await expect(page.locator('#testError')).toBeEmpty();
    await expect(page.locator('#test1Error')).toBeEmpty();
    await expect(page.locator('#test2Error')).toBeEmpty();

    await page.locator('#single').click();
    await expect(page.locator('#testError')).toContainText('required');
    await page.locator('#single').click();

    await page.locator('#multiple').click();
    await expect(page.locator('#test1Error')).toContainText('required');
    await expect(page.locator('#test2Error')).toContainText('required');

    await page.locator('#multiple').click();
    await expect(page.locator('#renderCount')).toContainText('6');
  });
});
