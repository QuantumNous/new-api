import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('autoUnregister', () => {
  test('should keep all inputs data when inputs get unmounted', async ({
    page,
  }) => {
    await page.goto('/autoUnregister');
    await type(page.locator('input[name="test"]'), 'test');
    await type(page.locator('input[name="test1"]'), 'test1');
    await page.locator('input[name="test2"]').check();
    await page.locator('input[name="test3"]').check();
    await page.locator('select[name="test4"]').selectOption('bill');
    await page.locator('#input-ReactSelect > div').click();
    await page.locator('#input-ReactSelect > div > div').nth(1).click();

    await page.locator('button').click();
    await page.locator('button').click();

    await expect(page.locator('input[name="test"]')).toHaveValue('test');
    await expect(page.locator('input[name="test1"]')).toHaveValue('test1');
    await expect(page.locator('input[name="test2"]')).toBeChecked();
    await expect(page.locator('input[name="test3"]')).toBeChecked();
    await expect(page.locator('select[name="test4"]')).toHaveValue('bill');
    await expect(
      page
        .locator('#input-ReactSelect > div > div > div > div')
        .filter({ hasText: 'Strawberry' }),
    ).toHaveCount(1);
  });
});
