import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('useFormState', () => {
  test('should subscribed to the form state without re-render the root', async ({
    page,
  }) => {
    await page.goto('/useFormState');
    await page.locator('button#submit').click();

    await type(page.locator('input[name="firstName"]'), 'bill');
    await type(page.locator('input[name="firstName"]'), 'a');
    await type(page.locator('input[name="arrayItem.0.test1"]'), 'ab');
    await type(page.locator('input[name="nestItem.nest1"]'), 'ab');
    await type(page.locator('input[name="lastName"]'), 'luo123456');
    await page.locator('select[name="selectNumber"]').focus();
    await page.locator('select[name="selectNumber"]').selectOption('1');
    await page.locator('select[name="selectNumber"]').blur();
    await type(page.locator('input[name="pattern"]'), 'luo');
    await type(page.locator('input[name="min"]'), '1');
    await type(page.locator('input[name="max"]'), '21');
    await page.locator('input[name="minDate"]').fill('2019-07-30');
    await page.locator('input[name="maxDate"]').fill('2019-08-02');
    await page.locator('input[name="lastName"]').clear();
    await type(page.locator('input[name="lastName"]'), 'luo');
    await type(page.locator('input[name="minLength"]'), 'b');
    await page.locator('input[name="minLength"]').blur();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        isDirty: true,
        touched: [
          'nestItem',
          'firstName',
          'arrayItem',
          'lastName',
          'selectNumber',
          'pattern',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
        ],
        dirty: [
          'nestItem',
          'arrayItem',
          'firstName',
          'lastName',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
          'selectNumber',
          'pattern',
        ],
        isSubmitted: true,
        isSubmitSuccessful: false,
        submitCount: 1,
        isValid: false,
      });

    await type(page.locator('input[name="pattern"]'), '23');
    await type(page.locator('input[name="minLength"]'), 'bi');
    await type(page.locator('input[name="minRequiredLength"]'), 'bi');
    await page.locator('input[name="min"]').clear();
    await type(page.locator('input[name="min"]'), '11');
    await page.locator('input[name="max"]').clear();
    await type(page.locator('input[name="max"]'), '19');
    await page.locator('input[name="minDate"]').fill('2019-08-01');
    await page.locator('input[name="maxDate"]').fill('2019-08-01');

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        isDirty: true,
        touched: [
          'nestItem',
          'firstName',
          'arrayItem',
          'lastName',
          'selectNumber',
          'pattern',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
        ],
        dirty: [
          'nestItem',
          'arrayItem',
          'firstName',
          'lastName',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
          'selectNumber',
          'pattern',
        ],
        isSubmitted: true,
        isSubmitSuccessful: false,
        submitCount: 1,
        isValid: true,
      });

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        isDirty: true,
        touched: [
          'nestItem',
          'firstName',
          'arrayItem',
          'lastName',
          'selectNumber',
          'pattern',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
        ],
        dirty: [
          'nestItem',
          'arrayItem',
          'firstName',
          'lastName',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
          'selectNumber',
          'pattern',
        ],
        isSubmitted: true,
        isSubmitSuccessful: true,
        submitCount: 2,
        isValid: true,
      });

    await page.locator('#resetForm').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        isDirty: false,
        touched: [],
        dirty: [],
        isSubmitted: false,
        isSubmitSuccessful: false,
        submitCount: 0,
        isValid: true,
      });

    await expect(page.locator('#renderCount')).toContainText('2');
  });
});
