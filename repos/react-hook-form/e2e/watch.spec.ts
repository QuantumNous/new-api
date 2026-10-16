import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('watch form validation', () => {
  test('should watch all inputs', async ({ page }) => {
    await page.goto('/watch');

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#watchAll').textContent()) || 'null'),
      )
      .toEqual({
        testSingle: '',
        test: ['', ''],
        testObject: { firstName: '', lastName: '' },
        toggle: false,
      });

    await expect(page.locator('#HideTestSingle')).toHaveCount(0);
    await type(page.locator('input[name="testSingle"]'), 'testSingle');
    await expect(page.locator('#HideTestSingle')).toContainText(
      'Hide Content TestSingle',
    );
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#watchAll').textContent()) || 'null'),
      )
      .toEqual({
        testSingle: 'testSingle',
        test: ['', ''],
        testObject: { firstName: '', lastName: '' },
        toggle: false,
      });

    await type(page.locator('input[name="test.0"]'), 'bill');
    await type(page.locator('input[name="test.1"]'), 'luo');
    await expect(page.locator('#testData')).toContainText('["bill","luo"]');
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#testArray').textContent()) || 'null'),
      )
      .toEqual(['bill', 'luo']);

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#watchAll').textContent()) || 'null'),
      )
      .toEqual({
        testSingle: 'testSingle',
        test: ['bill', 'luo'],
        testObject: { firstName: '', lastName: '' },
        toggle: false,
      });

    await type(page.locator('input[name="testObject.firstName"]'), 'bill');
    await type(page.locator('input[name="testObject.lastName"]'), 'luo');
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#testObject').textContent()) || 'null'),
      )
      .toEqual({
        firstName: 'bill',
        lastName: 'luo',
      });

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#testArray').textContent()) || 'null'),
      )
      .toEqual(['bill', 'luo']);

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#watchAll').textContent()) || 'null'),
      )
      .toEqual({
        testSingle: 'testSingle',
        test: ['bill', 'luo'],
        testObject: { firstName: 'bill', lastName: 'luo' },
        toggle: false,
      });

    await expect(page.locator('#hideContent')).toHaveCount(0);
    await page.locator('input[name="toggle"]').check();
    await expect(page.locator('#hideContent')).toContainText('Hide Content');

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#watchAll').textContent()) || 'null'),
      )
      .toEqual({
        testSingle: 'testSingle',
        test: ['bill', 'luo'],
        testObject: { firstName: 'bill', lastName: 'luo' },
        toggle: true,
      });
  });
});
