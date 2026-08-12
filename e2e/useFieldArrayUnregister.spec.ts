import { expect, test } from '@playwright/test';

import { expectRenderCountInRange, type } from './utils';

test.describe('useFieldArrayUnregister', () => {
  test('should behaviour correctly', async ({ page }) => {
    await page.goto('/UseFieldArrayUnregister');

    await page.locator('#field0').clear();
    await type(page.locator('#field0'), 'bill');

    await type(page.locator('input[name="data.0.conditional"]'), 'test');

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true, conditional: true }, null, null],
      });

    await page.locator('input[name="data.0.conditional"]').blur();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#touched').textContent()) || 'null'),
      )
      .toEqual([{ name: true, conditional: true }]);

    await page.locator('#prepend').click();

    await expect(page.locator('input[name="data.0.conditional"]')).toHaveCount(
      0,
    );
    await expect(page.locator('input[name="data.1.conditional"]')).toHaveValue(
      '',
    );

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [
          { name: true, conditional: true },
          { name: true, conditional: true },
          { name: true },
          { name: true },
        ],
      });

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#touched').textContent()) || 'null'),
      )
      .toEqual([null, { name: true, conditional: true }]);

    await page.locator('input[name="data.0.name"]').blur();

    await page.locator('#swap').click();

    await expect(page.locator('input[name="data.1.conditional"]')).toHaveCount(
      0,
    );
    await expect(page.locator('input[name="data.2.conditional"]')).toHaveValue(
      '',
    );

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [
          { name: true },
          null,
          { name: true, conditional: true },
          { name: true },
        ],
      });

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#touched').textContent()) || 'null'),
      )
      .toEqual([{ name: true }, null, { name: true, conditional: true }]);

    await page.locator('#insert').click();

    await page.locator('#insert').click();

    await type(page.locator('input[name="data.4.name"]'), 'test');

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [
          { name: true },
          { name: true, conditional: true },
          { name: true },
          { name: true },
          { name: true, conditional: true },
          { name: true },
        ],
      });

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#touched').textContent()) || 'null'),
      )
      .toEqual([
        { name: true },
        { name: true },
        { name: true },
        null,
        { name: true, conditional: true },
      ]);

    await page.locator('#move').click();

    await page.locator('input[name="data.2.name"]').clear();
    await type(page.locator('input[name="data.2.name"]'), 'bill');

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [
          { name: true },
          { name: true },
          { name: true, conditional: true },
          { name: true },
          { name: true },
          { name: true },
        ],
      });

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#touched').textContent()) || 'null'),
      )
      .toEqual([
        { name: true },
        { name: true },
        { name: true, conditional: true },
        { name: true },
        null,
      ]);

    await page.locator('#delete1').click();

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '6' },
          { name: 'bill', conditional: '' },
          { name: '11' },
          { name: 'test1' },
          { name: 'test2' },
        ],
      });

    await type(page.locator('input[name="data.3.name"]'), 'test');

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '6' },
          { name: 'bill', conditional: '' },
          { name: '11' },
          { name: 'test1test' },
          { name: 'test2' },
        ],
      });

    await page.locator('#delete3').click();

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '6' },
          { name: 'bill', conditional: '' },
          { name: '11' },
          { name: 'test2' },
        ],
      });

    // The exact render count is stable at 26 under Cypress, but verified
    // non-deterministic under Playwright (observed 29-30 across 5+ local
    // runs). Use a bounded range instead of an exact match.
    await expectRenderCountInRange(page.locator('#renderCount'), 27, 32);
  });
});
