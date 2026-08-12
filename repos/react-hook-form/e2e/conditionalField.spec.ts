import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('ConditionalField', () => {
  test('should reflect correct form state and data collection', async ({
    page,
  }) => {
    await page.goto('/conditionalField');

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: [],
        isSubmitted: false,
        submitCount: 0,
        touched: [],
        isDirty: false,
        isSubmitting: false,
        isSubmitSuccessful: false,
        isValid: false,
      });

    await page.locator('select[name="selectNumber"]').focus();
    await page.locator('select[name="selectNumber"]').selectOption('1');
    await page.locator('select[name="selectNumber"]').blur();
    await type(page.locator('input[name="firstName"]'), 'bill');
    await type(page.locator('input[name="lastName"]'), 'luo');
    await page.locator('input[name="lastName"]').blur();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: ['selectNumber', 'firstName', 'lastName'],
        isSubmitted: false,
        submitCount: 0,
        touched: ['selectNumber', 'firstName', 'lastName'],
        isDirty: true,
        isSubmitting: false,
        isSubmitSuccessful: false,
        isValid: true,
      });
    await page.locator('button#submit').click();
    await expect(page.locator('#result').first()).toContainText(
      '{"selectNumber":"1","firstName":"bill","lastName":"luo"}',
    );
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: ['selectNumber', 'firstName', 'lastName'],
        isSubmitted: true,
        submitCount: 1,
        touched: ['selectNumber', 'firstName', 'lastName'],
        isDirty: true,
        isSubmitting: false,
        isSubmitSuccessful: true,
        isValid: true,
      });
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#result').first().textContent()) || 'null',
        ),
      )
      .toEqual({
        selectNumber: '1',
        firstName: 'bill',
        lastName: 'luo',
      });

    await page.locator('select[name="selectNumber"]').selectOption('2');
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: ['selectNumber', 'firstName', 'lastName'],
        isSubmitted: true,
        submitCount: 1,
        touched: ['selectNumber', 'firstName', 'lastName'],
        isDirty: true,
        isSubmitting: false,
        isSubmitSuccessful: true,
        isValid: false,
      });
    await type(page.locator('input[name="min"]'), '10');
    await type(page.locator('input[name="max"]'), '2');
    await page.locator('input[name="max"]').blur();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: ['selectNumber', 'firstName', 'lastName', 'min', 'max'],
        isSubmitted: true,
        submitCount: 1,
        touched: ['selectNumber', 'firstName', 'lastName', 'min', 'max'],
        isDirty: true,
        isSubmitting: false,
        isSubmitSuccessful: true,
        isValid: true,
      });
    await page.locator('button#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: ['selectNumber', 'firstName', 'lastName', 'min', 'max'],
        isSubmitted: true,
        submitCount: 2,
        touched: ['selectNumber', 'firstName', 'lastName', 'min', 'max'],
        isDirty: true,
        isSubmitting: false,
        isSubmitSuccessful: true,
        isValid: true,
      });
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#result').first().textContent()) || 'null',
        ),
      )
      .toEqual({
        selectNumber: '2',
        firstName: 'bill',
        lastName: 'luo',
        min: '10',
        max: '2',
      });

    await page.locator('select[name="selectNumber"]').selectOption('3');
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: ['selectNumber', 'firstName', 'lastName', 'min', 'max'],
        isSubmitted: true,
        submitCount: 2,
        touched: ['selectNumber', 'firstName', 'lastName', 'min', 'max'],
        isDirty: true,
        isSubmitting: false,
        isSubmitSuccessful: true,
        isValid: true,
      });

    await type(page.locator('input[name="notRequired"]'), 'test');
    await page.locator('input[name="notRequired"]').blur();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#state').textContent()) || 'null'),
      )
      .toEqual({
        dirty: [
          'selectNumber',
          'firstName',
          'lastName',
          'min',
          'max',
          'notRequired',
        ],
        isSubmitted: true,
        submitCount: 2,
        touched: [
          'selectNumber',
          'firstName',
          'lastName',
          'min',
          'max',
          'notRequired',
        ],
        isDirty: true,
        isSubmitting: false,
        isSubmitSuccessful: true,
        isValid: true,
      });

    await page.locator('button#submit').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#result').first().textContent()) || 'null',
        ),
      )
      .toEqual({
        selectNumber: '3',
        firstName: 'bill',
        lastName: 'luo',
        min: '10',
        max: '2',
        notRequired: 'test',
      });

    await expect(page.locator('#renderCount')).toContainText('28');
  });
});
