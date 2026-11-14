import { expect, test } from '@playwright/test';

test.describe('useFieldArray', () => {
  test('should behaviour correctly without defaultValues', async ({ page }) => {
    await page.goto('/useFieldArray/normal');

    await page.locator('#appendAsync').click();

    await expect(page.locator(':focus')).toHaveAttribute('id', 'field0');

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'appendAsync',
    );

    await expect(page.locator(':focus')).toHaveAttribute('id', 'field0');

    await page.locator('#prependAsync').click();

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'prependAsync',
    );

    await page.locator('#insertAsync').click();

    await expect(page.locator(':focus')).toHaveAttribute('id', 'field1');

    await expect(page.locator('#field1')).toHaveValue('insertAsync');

    await page.locator('#swapAsync').click();

    await expect(page.locator('#field0')).toHaveValue('insertAsync');
    await expect(page.locator('#field1')).toHaveValue('prependAsync');

    await page.locator('#moveAsync').click();

    await expect(page.locator('#field1')).toHaveValue('insertAsync');
    await expect(page.locator('#field0')).toHaveValue('prependAsync');

    await page.locator('#updateAsync').click();

    await expect(page.locator('#field0')).toHaveValue('updateAsync');

    await page.locator('#replaceAsync').click();

    await expect(page.locator('#field0')).toHaveValue('12. lorem');
    await expect(page.locator('#field1')).toHaveValue('12. ipsum');
    await expect(page.locator('#field2')).toHaveValue('12. dolor');
    await expect(page.locator('#field3')).toHaveValue('12. sit amet');

    await page.locator('#removeAsync').click();

    await page.locator('#resetAsync').click();

    await expect(page.locator('ul > li')).toHaveCount(0);
  });
});
