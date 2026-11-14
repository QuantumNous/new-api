import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('watchUseFieldArray', () => {
  test('should behaviour correctly when watching the field array', async ({
    page,
  }) => {
    await page.goto('/watch-field-array/normal');

    await page.locator('#append').click();
    await expect(page.locator('#result')).toContainText('[{"name":"2"}]');

    await type(page.locator('#field0'), 'test');
    await expect(page.locator('#result')).toContainText('[{"name":"2test"}]');

    await page.locator('#prepend').click();
    await expect(page.locator('#result')).toContainText(
      '[{"name":"8"},{"name":"2test"}]',
    );

    await page.locator('#append').click();
    await page.locator('#append').click();
    await page.locator('#append').click();
    await page.locator('#update').click();
    await expect(page.locator('#result')).toContainText(
      '[{"name":"8"},{"name":"2test"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    await page.locator('#swap').click();
    await expect(page.locator('#result')).toContainText(
      '[{"name":"8"},{"name":"10"},{"name":"2test"},{"name":"updated value"},{"name":"14"}]',
    );

    await page.locator('#move').click();
    await expect(page.locator('#result')).toContainText(
      '[{"name":"2test"},{"name":"8"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    await page.locator('#insert').click();
    await expect(page.locator('#result')).toContainText(
      '[{"name":"2test"},{"name":"22"},{"name":"8"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    await page.locator('#remove').click();
    await expect(page.locator('#result')).toContainText(
      '[{"name":"2test"},{"name":"8"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    await page.locator('#removeAll').click();
    await expect(page.locator('#result')).toContainText('[]');
    await expect(page.locator('#renderCount')).toContainText('28');
  });

  test('should return empty when items been removed and defaultValues are supplied', async ({
    page,
  }) => {
    await page.goto('/watch-field-array/default');

    await page.locator('#delete0').click();
    await page.locator('#delete0').click();
    await page.locator('#delete0').click();

    await expect(page.locator('#result')).toContainText('[]');
  });
});
