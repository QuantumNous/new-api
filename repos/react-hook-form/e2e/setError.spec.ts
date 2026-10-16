import { expect, test } from '@playwright/test';

test.describe('form setError', () => {
  test('should contain 3 errors when page land', async ({ page }) => {
    await page.goto('/setError');

    await expect(page.locator('#error0')).toContainText('0 wrong');
    await expect(page.locator('#error1')).toContainText('1 wrong');
    await expect(page.locator('#error2')).toContainText('2 wrong');
    await expect(page.locator('#error3')).toContainText('3 test');
    await expect(page.locator('#error4')).toContainText('4 required');
    await expect(page.locator('#error5')).toContainText('5 minLength');
    await expect(page.locator('#error')).toContainText(
      'testMessageThis is required.Minlength is 10This is requiredThis is minLength',
    );
  });

  test('should clear individual error', async ({ page }) => {
    await page.goto('/setError');

    await page.locator('#clear1').click();
    await page.locator('#clear2').click();
    await expect(page.locator('#error0')).toContainText('0 wrong');
  });

  test('should clear an array of errors', async ({ page }) => {
    await page.goto('/setError');

    await page.locator('#clearArray').click();
    await expect(page.locator('#error0')).toContainText('0 wrong');
  });

  test('should clear every errors', async ({ page }) => {
    await page.goto('/setError');

    await page.locator('#clear').click();
    await expect(page.locator('#errorContainer')).toBeEmpty();
  });
});
