import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('form setValue with trigger', () => {
  test('should set input value and trigger validation', async ({ page }) => {
    await page.goto('/setValueWithTrigger');

    await type(page.locator('input[name="firstName"]'), 'a');
    await expect(page.locator('input[name="firstName"] + p')).toContainText(
      'minLength 10',
    );
    await page.locator('input[name="firstName"]').clear();
    await expect(page.locator('input[name="firstName"] + p')).toContainText(
      'required',
    );
    await type(page.locator('input[name="firstName"]'), 'clear1234567');

    await type(page.locator('input[name="lastName"]'), 'a');
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'too short',
    );
    await type(page.locator('input[name="lastName"]'), 'fsdfsdfsd');
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'error message',
    );
    await page.locator('input[name="lastName"]').clear();
    await type(page.locator('input[name="lastName"]'), 'bill');

    await expect(page.locator('p')).toHaveCount(0);
    await expect(page.locator('#renderCount')).toContainText('31');
  });
});
