import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('delayError', () => {
  test('should delay from errors appear', async ({ page }) => {
    await page.goto('/delayError');

    const firstInput = page.locator('input[name="first"]');
    const firstInputError = page.locator('input[name="first"] + p');
    const lastInput = page.locator('input[name="last"]');
    const lastInputError = page.locator('input[name="last"] + p');

    await type(firstInput, '123');
    await expect(firstInputError).toContainText('First too long.');

    await type(lastInput, '123567');
    await expect(lastInputError).toContainText('Last too long.');

    await lastInput.blur();
    await page.locator('button').click();

    await type(firstInput, '123');
    await type(lastInput, '123567');

    await expect(firstInputError).toContainText('First too long.');
    await expect(lastInputError).toContainText('Last too long.');

    await firstInput.clear();
    await type(firstInput, '1');
    await lastInput.clear();
    await type(lastInput, '12');

    await lastInput.blur();

    await expect(page.locator('p')).toHaveCount(0);

    await page.locator('button').click();

    await type(firstInput, 'aa');
    await type(lastInput, 'a');

    await expect(firstInputError).toContainText('First too long.');
    await expect(lastInputError).toContainText('Last too long.');

    await firstInput.clear();
    await type(firstInput, '1');
    await lastInput.clear();
    await type(lastInput, '12');

    await lastInput.blur();

    await expect(page.locator('p')).toHaveCount(0);
  });
});
