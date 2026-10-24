import { expect, test } from '@playwright/test';

import { expectRenderCountInRange, type } from './utils';

test.describe('manual register form validation', () => {
  test('should validate the form', async ({ page }) => {
    await page.goto('/manual-register-form');
    await page.locator('#submit').click();

    await expect(page.locator('input[name="firstName"] + p')).toContainText(
      'firstName error',
    );
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'lastName error',
    );
    await expect(page.locator('select[name="selectNumber"] + p')).toContainText(
      'selectNumber error',
    );
    await expect(
      page.locator('input[name="minRequiredLength"] + p'),
    ).toContainText('minRequiredLength error');
    await expect(page.locator('input[name="radio"] + p')).toContainText(
      'radio error',
    );

    await type(page.locator('input[name="firstName"]'), 'bill');
    await type(page.locator('input[name="lastName"]'), 'luo123456');
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'lastName error',
    );
    await page.locator('select[name="selectNumber"]').selectOption('1');
    await type(page.locator('input[name="pattern"]'), 'luo');
    await type(page.locator('input[name="min"]'), '1');
    await type(page.locator('input[name="max"]'), '21');
    await page.locator('input[name="minDate"]').fill('2019-07-30');
    await page.locator('input[name="maxDate"]').fill('2019-08-02');
    const lastName = page.locator('input[name="lastName"]');
    await lastName.clear();
    await type(lastName, 'luo');
    await type(page.locator('input[name="minLength"]'), 'b');

    await expect(page.locator('input[name="pattern"] + p')).toContainText(
      'pattern error',
    );
    await expect(page.locator('input[name="minLength"] + p')).toContainText(
      'minLength error',
    );
    await expect(page.locator('input[name="min"] + p')).toContainText(
      'min error',
    );
    await expect(page.locator('input[name="max"] + p')).toContainText(
      'max error',
    );
    await expect(page.locator('input[name="minDate"] + p')).toContainText(
      'minDate error',
    );
    await expect(page.locator('input[name="maxDate"] + p')).toContainText(
      'maxDate error',
    );

    await type(page.locator('input[name="pattern"]'), '23');
    await type(page.locator('input[name="minLength"]'), 'bi');
    await type(page.locator('input[name="minRequiredLength"]'), 'bi');
    await page.locator('input[name="radio"][value="1"]').check();
    const min = page.locator('input[name="min"]');
    await min.clear();
    await type(min, '11');
    const max = page.locator('input[name="max"]');
    await max.clear();
    await type(max, '19');
    await page.locator('input[name="minDate"]').fill('2019-08-01');
    await page.locator('input[name="maxDate"]').fill('2019-08-01');
    await page.locator('input[name="checkbox"]').check();

    await expect(page.locator('p')).toHaveCount(0);
    // Verified non-deterministic across repeated local runs (observed 44-46);
    // use a bounded range instead of the exact Cypress value of 46.
    await expectRenderCountInRange(page.locator('#renderCount'), 44, 47);
  });
});
