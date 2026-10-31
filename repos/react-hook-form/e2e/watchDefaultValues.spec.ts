import { expect, test } from '@playwright/test';

test.describe('watchDefaultValues', () => {
  test('should return default value with watch', async ({ page }) => {
    await page.goto('/watch-default-values');

    await expect(page.locator('#watchAll')).toHaveText(
      '{"test":"test","test1":{"firstName":"firstName","lastName":["lastName0","lastName1"],"deep":{"nest":"nest"}},"flatName[1]":{"whatever":"flat"}}',
    );
    await expect(page.locator('#array')).toHaveText(
      '["test",{"whatever":"flat"}]',
    );
    await expect(page.locator('#getArray')).toHaveText(
      '["lastName0","lastName1"]',
    );
    await expect(page.locator('#object')).toHaveText('["test","firstName"]');
    await expect(page.locator('#single')).toHaveText('"firstName"');
    await expect(page.locator('#singleDeepArray')).toHaveText('"lastName0"');
  });
});
