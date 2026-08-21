import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('isValid', () => {
  test('should showing valid correctly with build in validation', async ({
    page,
  }) => {
    await page.goto('/isValid/build-in/defaultValue');
    await expect(page.locator('#isValid')).toContainText('false');

    await type(page.locator('input[name="firstName"]'), 'test');
    await expect(page.locator('#isValid')).toContainText('false');
    await type(page.locator('input[name="lastName"]'), 'test');
    await expect(page.locator('#isValid')).toContainText('true');
    await expect(page.locator('#renderCount')).toContainText('3');
    await page.locator('#toggle').click();
    await expect(page.locator('#isValid')).toContainText('false');
    await page.locator('#toggle').click();
    await expect(page.locator('#isValid')).toContainText('true');
  });

  test('should showing valid correctly with build in validation and default values supplied', async ({
    page,
  }) => {
    await page.goto('/isValid/build-in/defaultValues');
    await expect(page.locator('#isValid')).toContainText('true');

    await page.locator('input[name="firstName"]').clear();
    await expect(page.locator('#isValid')).toContainText('false');
    await expect(page.locator('#renderCount')).toContainText('4');
    await page.locator('#toggle').click();
    await expect(page.locator('#isValid')).toContainText('false');
  });

  test('should showing valid correctly with schema validation', async ({
    page,
  }) => {
    await page.goto('/isValid/schema/defaultValue');
    await expect(page.locator('#isValid')).toContainText('false');

    await type(page.locator('input[name="firstName"]'), 'test');
    await expect(page.locator('#isValid')).toContainText('false');
    await type(page.locator('input[name="lastName"]'), 'test');
    await expect(page.locator('#isValid')).toContainText('true');
    await page.locator('#toggle').click();
    await expect(page.locator('#isValid')).toContainText('false');
    await page.locator('#toggle').click();
    await type(page.locator('input[name="firstName"]'), 'test');
    await expect(page.locator('#isValid')).toContainText('true');
    await expect(page.locator('#renderCount')).toContainText('7');
  });

  test('should showing valid correctly with schema validation and default value supplied', async ({
    page,
  }) => {
    await page.goto('/isValid/schema/defaultValues');
    await expect(page.locator('#isValid')).toContainText('true');

    await page.locator('input[name="firstName"]').clear();
    await expect(page.locator('#isValid')).toContainText('false');
    await expect(page.locator('#renderCount')).toContainText('4');
    await type(page.locator('input[name="firstName"]'), 'test');
    await expect(page.locator('#isValid')).toContainText('true');
    await page.locator('#toggle').click();
    await expect(page.locator('#isValid')).toContainText('false');
    await page.locator('#toggle').click();
    await type(page.locator('input[name="firstName"]'), 't');
    await expect(page.locator('#isValid')).toContainText('true');
  });
});
