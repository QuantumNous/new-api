import { expect, test } from '@playwright/test';

test.describe('defaultValues async', () => {
  test('should populate defaultValue async for inputs', async ({ page }) => {
    await page.goto('/default-values-async');

    await expect(page.locator('input[name="test"]')).toHaveValue('test');
    await expect(page.locator('input[name="test1.firstName"]')).toHaveValue(
      'firstName',
    );
    await expect(page.locator('input[name="test1.lastName.0"]')).toHaveValue(
      'lastName0',
    );
    await expect(page.locator('input[name="test1.lastName.1"]')).toHaveValue(
      'lastName1',
    );
    await expect(page.locator('input[name="checkbox"]').nth(0)).toBeChecked();
    await expect(page.locator('input[name="checkbox"]').nth(1)).toBeChecked();

    await page.locator('input[name="checkbox"]').nth(0).click();
    await page.locator('#toggle').click();
    await page.locator('#toggle').click();

    await expect(
      page.locator('input[name="checkbox"]').nth(0),
    ).not.toBeChecked();
    await expect(page.locator('input[name="checkbox"]').nth(1)).toBeChecked();
    await page.locator('input[name="checkbox"]').nth(1).click();

    await page.locator('#toggle').click();
    await page.locator('#toggle').click();

    await expect(
      page.locator('input[name="checkbox"]').nth(0),
    ).not.toBeChecked();
    await expect(
      page.locator('input[name="checkbox"]').nth(1),
    ).not.toBeChecked();
  });
});
