import { expect, test } from '@playwright/test';

import { expectRenderCountInRange, type } from './utils';

test.describe('validate field criteria', () => {
  test('should validate the form, show all errors and clear all', async ({
    page,
  }) => {
    await page.goto('/validate-field-criteria');
    await page.locator('button#submit').click();
    await expect(page.locator('input[name="firstName"] + p')).toContainText(
      'firstName required',
    );
    await type(page.locator('input[name="firstName"]'), 'te');
    await expect(page.locator('input[name="firstName"] + p')).toContainText(
      'firstName minLength',
    );
    await type(page.locator('input[name="firstName"]'), 'testtesttest');

    await expect(page.locator('input[name="min"] + p')).toContainText(
      'min required',
    );
    await type(page.locator('input[name="min"]'), '2');
    await expect(page.locator('input[name="min"] + p')).toContainText(
      'min min',
    );
    await type(page.locator('input[name="min"]'), '32');
    await expect(page.locator('input[name="min"] + p')).toContainText(
      'min max',
    );
    await page.locator('input[name="min"]').clear();
    await type(page.locator('input[name="min"]'), '10');

    await expect(page.locator('input[name="minDate"] + p')).toContainText(
      'minDate required',
    );
    await page.locator('input[name="minDate"]').fill('2019-07-01');
    await expect(page.locator('input[name="minDate"] + p')).toContainText(
      'minDate min',
    );
    await page.locator('input[name="minDate"]').fill('2019-08-01');

    await expect(page.locator('input[name="maxDate"] + p')).toContainText(
      'maxDate required',
    );
    await page.locator('input[name="maxDate"]').fill('2019-09-01');
    await expect(page.locator('input[name="maxDate"] + p')).toContainText(
      'maxDate max',
    );
    await page.locator('input[name="maxDate"]').fill('2019-08-01');

    await expect(page.locator('input[name="minLength"] + p')).toContainText(
      'minLength required',
    );
    await type(page.locator('input[name="minLength"]'), '1');
    await expect(page.locator('input[name="minLength"] + p')).toContainText(
      'minLength minLength',
    );
    await type(page.locator('input[name="minLength"]'), '12');

    await expect(page.locator('select[name="selectNumber"] + p')).toContainText(
      'selectNumber required',
    );
    await page.locator('select[name="selectNumber"]').selectOption('12');

    await expect(page.locator('input[name="pattern"] + p')).toContainText(
      'pattern required',
    );
    await type(page.locator('input[name="pattern"]'), 't');
    await expect(page.locator('input[name="pattern"] + p')).toContainText(
      'pattern pattern',
    );
    await expect(page.locator('input[name="pattern"] + p + p')).toContainText(
      'pattern minLength',
    );
    await page.locator('input[name="pattern"]').clear();
    await type(page.locator('input[name="pattern"]'), '12345');

    await expect(page.locator('select[name="multiple"] + p')).toContainText(
      'multiple required',
    );
    await expect(page.locator('select[name="multiple"] + p + p')).toContainText(
      'multiple validate',
    );
    await page.locator('select[name="multiple"]').selectOption('optionA');
    await page.locator('select[name="multiple"]').selectOption('optionB');

    await expect(page.locator('input[name="validate"] + p')).toContainText(
      'validate test',
    );
    await expect(page.locator('input[name="validate"] + p + p')).toContainText(
      'validate test1',
    );
    await expect(
      page.locator('input[name="validate"] + p + p + p'),
    ).toContainText('validate test2');
    await type(page.locator('input[name="validate"]'), 'test');

    await expect(page.locator('p')).toHaveCount(0);

    await page.locator('#trigger').click();
    await expect(page.locator('p')).toHaveCount(2);
    await expect(page.locator('b')).toHaveCount(2);

    await page.locator('#clear').click();
    await expect(page.locator('p')).toHaveCount(0);
    await expect(page.locator('b')).toHaveCount(0);

    // Verified non-deterministic across repeated local runs (observed 26-30);
    // exact Cypress count was 28.
    await expectRenderCountInRange(page.locator('#renderCount'), 24, 32);
  });
});
