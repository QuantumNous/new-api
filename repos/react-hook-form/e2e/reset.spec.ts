import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('form reset', () => {
  test('should be able to re-populate the form while reset', async ({
    page,
  }) => {
    await page.goto('/reset');

    await type(page.locator('input[name="firstName"]'), '0 wrong');
    await type(page.locator('input[name="array.1"]'), '1 wrong');
    await type(page.locator('input[name="objectData.test"]'), '2 wrong');
    await type(page.locator('input[name="lastName"]'), 'lastName');
    await type(
      page.locator('input[name="deepNest.level1.level2.data"]'),
      'whatever',
    );

    await page.locator('button').click();

    await expect(page.locator('input[name="firstName"]')).toHaveValue('bill');
    await expect(page.locator('input[name="lastName"]')).toHaveValue('luo');
    await expect(page.locator('input[name="array.1"]')).toHaveValue('test');
    await expect(page.locator('input[name="objectData.test"]')).toHaveValue(
      'data',
    );
    await expect(
      page.locator('input[name="deepNest.level1.level2.data"]'),
    ).toHaveValue('hey');
  });

  test('should be able to re-populate the form while reset keeping dirty values', async ({
    page,
  }) => {
    await page.goto('/resetKeepDirty');
    await expect(page.locator('input[name="firstName"]')).toHaveValue('');
    await expect(page.locator('input[name="users"]')).toHaveValue('users#0');
    await expect(page.locator('input[name="objectData.test"]')).toHaveValue('');
    await expect(page.locator('input[name="lastName"]')).toHaveValue('');
    await expect(
      page.locator('input[name="deepNest.level1.level2.data"]'),
    ).toHaveValue('');

    await page.locator('button', { hasText: 'Add item' }).click();
    await expect(page.locator('input[name="users"]')).toHaveValue('users#1');
    await page.locator('button', { hasText: 'button' }).click();

    await expect(page.locator('input[name="firstName"]')).toHaveValue('bill');
    await expect(page.locator('input[name="lastName"]')).toHaveValue('luo');
    await expect(page.locator('input[name="users"]')).toHaveValue('users#1');
    await expect(page.locator('input[name="objectData.test"]')).toHaveValue(
      'data',
    );
    await expect(
      page.locator('input[name="deepNest.level1.level2.data"]'),
    ).toHaveValue('hey');
  });
});
