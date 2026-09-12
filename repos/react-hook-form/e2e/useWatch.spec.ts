import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('useWatch', () => {
  test('should only trigger render when interact with input 1', async ({
    page,
  }) => {
    await page.goto('/useWatch');
    await type(page.locator('input[name="test"]'), 't');

    await expect(page.locator('#parentCounter')).toContainText('2');
    await expect(page.locator('#childCounter')).toContainText('2');
    await expect(page.locator('#grandChildCounter').first()).toContainText('3');
    await expect(page.locator('#grandChild1Counter')).toContainText('3');
    await expect(page.locator('#grandChild2Counter')).toContainText('3');
    await expect(page.locator('#grandchild01')).toContainText('t');
    await expect(page.locator('#grandchild00')).toContainText('t');

    await type(page.locator('input[name="test"]'), 'h');
    await expect(page.locator('#grandchild00')).toContainText('th');
    await expect(page.locator('#grandchild01')).toContainText('th');
    await expect(page.locator('#grandchild2')).toContainText('t');
  });

  test('should only trigger render when interact with input 2', async ({
    page,
  }) => {
    await page.goto('/useWatch');
    await type(page.locator('input[name="test1"]'), 'h');

    await expect(page.locator('#parentCounter')).toContainText('2');
    await expect(page.locator('#childCounter')).toContainText('2');
    await expect(page.locator('#grandChildCounter').first()).toContainText('3');
    await expect(page.locator('#grandChild1Counter')).toContainText('3');
    await expect(page.locator('#grandChild2Counter')).toContainText('3');

    await type(page.locator('input[name="test1"]'), 'h');
    await type(page.locator('input[name="test"]'), 'h');
    await expect(page.locator('#grandchild00')).toContainText('h');
    await expect(page.locator('#grandchild01')).toContainText('h');
    await expect(page.locator('#grandchild1')).toContainText('hh');
    await expect(page.locator('#grandchild2')).toContainText('hhh');
  });

  test('should only trigger render when interact with input 3', async ({
    page,
  }) => {
    await page.goto('/useWatch');
    await type(page.locator('input[name="test2"]'), 'e');

    await expect(page.locator('#parentCounter')).toContainText('2');
    await expect(page.locator('#childCounter')).toContainText('2');
    await expect(page.locator('#grandChildCounter').first()).toContainText('3');
    await expect(page.locator('#grandChild1Counter')).toContainText('3');
    await expect(page.locator('#grandChild2Counter')).toContainText('3');

    await type(page.locator('input[name="test2"]'), 'eh');

    await type(page.locator('input[name="test1"]'), 'eh');
    await type(page.locator('input[name="test"]'), 'eh');
    await expect(page.locator('#grandchild00')).toContainText('eh');
    await expect(page.locator('#grandchild01')).toContainText('eh');
    await expect(page.locator('#grandchild1')).toContainText('eh');
    await expect(page.locator('#grandchild2')).toContainText('eheheeh');
  });
});
