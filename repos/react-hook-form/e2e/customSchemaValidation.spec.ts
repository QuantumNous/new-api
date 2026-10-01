import { expect, test } from '@playwright/test';

import { expectRenderCountInRange, type } from './utils';

test.describe('customSchemaValidation form validation', () => {
  test('should validate the form with onSubmit mode', async ({ page }) => {
    await page.goto('/customSchemaValidation/onSubmit');
    await page.locator('button').click();

    await expect(page.locator(':focus')).toHaveAttribute('name', 'firstName');

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
    await page.locator('input[name="lastName"]').clear();
    await type(page.locator('input[name="lastName"]'), 'luo');
    await type(page.locator('input[name="minLength"]'), '2');
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
    await page.locator('input[name="min"]').clear();
    await type(page.locator('input[name="min"]'), '11');
    await page.locator('input[name="max"]').clear();
    await type(page.locator('input[name="max"]'), '19');
    await page.locator('input[name="minDate"]').fill('2019-08-01');
    await page.locator('input[name="maxDate"]').fill('2019-08-01');
    await expect(page.locator('input[name="maxDate"] + p')).toHaveCount(0);
    await page.locator('input[name="checkbox"]').check();

    await expect(page.locator('p')).toHaveCount(0);
    await expectRenderCountInRange(page.locator('#renderCount'), 22, 28);
  });

  test('should validate the form with onBlur mode', async ({ page }) => {
    await page.goto('/customSchemaValidation/onBlur');

    await page.locator('input[name="firstName"]').focus();
    await page.locator('input[name="firstName"]').blur();
    await expect(page.locator('input[name="firstName"] + p')).toContainText(
      'firstName error',
    );
    await type(page.locator('input[name="firstName"]'), 'bill');
    await page.locator('input[name="lastName"]').focus();
    await page.locator('input[name="lastName"]').blur();
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'lastName error',
    );
    await type(page.locator('input[name="lastName"]'), 'luo123456');
    await page.locator('input[name="lastName"]').blur();
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'lastName error',
    );
    await page.locator('select[name="selectNumber"]').focus();
    await page.locator('select[name="selectNumber"]').blur();
    await expect(page.locator('select[name="selectNumber"] + p')).toContainText(
      'selectNumber error',
    );
    const selectNumber = page.locator('select[name="selectNumber"]');
    await selectNumber.focus();
    await selectNumber.selectOption('1');
    await selectNumber.blur();
    await type(page.locator('input[name="pattern"]'), 'luo');
    await type(page.locator('input[name="min"]'), '1');
    await type(page.locator('input[name="max"]'), '21');
    await page.locator('input[name="minDate"]').fill('2019-07-30');
    await page.locator('input[name="maxDate"]').fill('2019-08-02');
    await page.locator('input[name="lastName"]').clear();
    await type(page.locator('input[name="lastName"]'), 'luo');
    await type(page.locator('input[name="minLength"]'), '2');
    await page.locator('input[name="minLength"]').blur();

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
    await page.locator('input[name="radio"]').first().focus();
    await page.locator('input[name="radio"]').first().blur();
    await expect(page.locator('input[name="radio"] + p')).toContainText(
      'radio error',
    );
    await page.locator('input[name="radio"][value="1"]').check();
    await page.locator('input[name="min"]').clear();
    await type(page.locator('input[name="min"]'), '11');
    await page.locator('input[name="max"]').clear();
    await type(page.locator('input[name="max"]'), '19');
    await page.locator('input[name="minDate"]').fill('2019-08-01');
    await page.locator('input[name="maxDate"]').fill('2019-08-01');
    await page.locator('input[name="maxDate"]').blur();
    await expect(page.locator('input[name="maxDate"] + p')).toHaveCount(0);
    await page.locator('input[name="checkbox"]').check();

    await expect(page.locator('p')).toHaveCount(0);
  });

  test('should validate the form with onChange mode', async ({ page }) => {
    await page.goto('/customSchemaValidation/onChange');

    await type(page.locator('input[name="firstName"]'), 'bill');
    await page.locator('input[name="lastName"]').focus();
    await type(page.locator('input[name="lastName"]'), 'luo123456');
    await page.locator('input[name="lastName"]').clear();
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'lastName error',
    );
    await type(page.locator('input[name="lastName"]'), 'luo123456');
    await expect(page.locator('input[name="lastName"] + p')).toContainText(
      'lastName error',
    );
    await page.locator('select[name="selectNumber"]').selectOption('1');
    await page.locator('select[name="selectNumber"]').selectOption('');
    await expect(page.locator('select[name="selectNumber"] + p')).toContainText(
      'selectNumber error',
    );
    await page.locator('select[name="selectNumber"]').selectOption('1');
    await type(page.locator('input[name="pattern"]'), 'luo');
    await type(page.locator('input[name="min"]'), '1');
    await type(page.locator('input[name="max"]'), '21');
    await page.locator('input[name="minDate"]').fill('2019-07-30');
    await page.locator('input[name="maxDate"]').fill('2019-08-02');
    await page.locator('input[name="lastName"]').clear();
    await type(page.locator('input[name="lastName"]'), 'luo');
    await type(page.locator('input[name="minLength"]'), '2');

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
    await page.locator('input[name="radio"]').first().focus();
    await page.locator('input[name="radio"][value="1"]').check();
    await page.locator('input[name="min"]').clear();
    await type(page.locator('input[name="min"]'), '11');
    await page.locator('input[name="max"]').clear();
    await type(page.locator('input[name="max"]'), '19');
    await page.locator('input[name="minDate"]').fill('2019-08-01');
    await page.locator('input[name="maxDate"]').fill('2019-08-01');
    await expect(page.locator('input[name="maxDate"] + p')).toHaveCount(0);
    await page.locator('input[name="checkbox"]').check();

    await expect(page.locator('p')).toHaveCount(0);
    await expectRenderCountInRange(page.locator('#renderCount'), 19, 25);
  });
});
