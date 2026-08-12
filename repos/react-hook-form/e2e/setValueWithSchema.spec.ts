import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('form setValue with schema', () => {
  test('should set input value, trigger validation and clear all errors', async ({
    page,
  }) => {
    await page.goto('/setValueWithSchema');

    await type(page.locator('input[name="firstName"]'), 'a');
    await expect(page.locator('input[name="firstName"] + p')).toContainText(
      'firstName error',
    );
    await expect(page.locator('p')).toHaveCount(1);
    await type(page.locator('input[name="firstName"]'), 'asdasdasdasd');

    await type(page.locator('input[name="lastName"]'), 'a');
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'lastName error',
    );
    await expect(page.locator('p')).toHaveCount(1);
    await type(page.locator('input[name="lastName"]'), 'asdasdasdasd');

    await type(page.locator('input[name="age"]'), 'a2323');

    await page.locator('#submit').click();
    await expect(page.locator('p')).toHaveCount(1);
    await expect(page.locator('input[name="requiredField"] + p')).toContainText(
      'RequiredField error',
    );

    await page.locator('#setValue').click();
    await expect(page.locator('input[name="requiredField"]')).toHaveValue(
      'test123456789',
    );
    await expect(page.locator('p')).toHaveCount(0);

    await expect(page.locator('#renderCount')).toContainText('35');
  });
});
