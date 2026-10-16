import { expect, test } from '@playwright/test';

test.describe('useFieldArrayNested', () => {
  test('should work correctly with nested field array', async ({ page }) => {
    await page.goto('/useFieldArrayNested');

    await page.locator('#nest-append-0').click();
    await page.locator('#nest-prepend-0').click();
    await page.locator('#nest-insert-0').click();
    await page.locator('#nest-swap-0').click();
    await page.locator('#nest-move-0').click();

    await expect(
      page.locator('input[name="test.0.keyValue.0.name"]'),
    ).toHaveValue('insert');
    await expect(
      page.locator('input[name="test.0.keyValue.1.name"]'),
    ).toHaveValue('prepend');
    await expect(
      page.locator('input[name="test.0.keyValue.2.name"]'),
    ).toHaveValue('1a');
    await expect(
      page.locator('input[name="test.0.keyValue.3.name"]'),
    ).toHaveValue('1c');
    await expect(
      page.locator('input[name="test.0.keyValue.4.name"]'),
    ).toHaveValue('append');

    await page.locator('#nest-remove-0').click();
    await expect(
      page.locator('input[name="test.0.keyValue.2.name"]'),
    ).toHaveValue('1c');
    await expect(
      page.locator('input[name="test.0.keyValue.3.name"]'),
    ).toHaveValue('append');

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirty-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          {
            keyValue: [
              { name: true },
              { name: true },
              { name: true },
              { name: true },
            ],
          },
        ],
      });

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#touched-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [{ keyValue: [{ name: true }, null, null, { name: true }] }],
      });

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        test: [
          {
            firstName: 'Bill',
            lastName: 'Luo',
            keyValue: [
              { name: 'insert' },
              { name: '1a' },
              { name: '1c' },
              { name: 'append' },
            ],
          },
        ],
      });

    await page.locator('#prepend').click();

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirty-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          {
            keyValue: [{ name: true }, { name: true }],
            firstName: true,
            lastName: true,
          },
          {
            firstName: true,
            lastName: true,
            keyValue: [
              { name: true },
              { name: true },
              { name: true },
              { name: true },
            ],
          },
        ],
      });

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#touched-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          null,
          { keyValue: [{ name: true }, null, null, { name: true }] },
        ],
      });

    await page.locator('#append').click();
    await page.locator('#swap').click();
    await page.locator('#insert').click();

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#touched-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          { firstName: true },
          null,
          { firstName: true },
          { keyValue: [{ name: true }, null, null, { name: true }] },
        ],
      });

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirty-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          {
            firstName: true,
            keyValue: [{ name: true }, { name: true }],
            lastName: true,
          },
          { firstName: true },
          { firstName: true },
          {
            firstName: true,
            lastName: true,
            keyValue: [
              { name: true },
              { name: true },
              { name: true },
              { name: true },
            ],
          },
        ],
      });

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        test: [
          { firstName: 'prepend', keyValue: [] },
          { firstName: 'insert', keyValue: [] },
          { firstName: 'append', keyValue: [] },
          {
            firstName: 'Bill',
            keyValue: [
              { name: 'insert' },
              { name: '1a' },
              { name: '1c' },
              { name: 'append' },
            ],
            lastName: 'Luo',
          },
        ],
      });

    await page.locator('#nest-append-0').click();
    await page.locator('#nest-prepend-0').click();
    await page.locator('#nest-insert-0').click();
    await page.locator('#nest-swap-0').click();
    await page.locator('#nest-move-0').click();

    await expect(page.locator('input')).toHaveCount(11);

    await page.locator('#nest-remove-3').click();
    await page.locator('#nest-remove-3').click();

    await expect(
      page.locator('input[name="test.3.keyValue.0.name"]'),
    ).toHaveValue('insert');
    await expect(
      page.locator('input[name="test.3.keyValue.1.name"]'),
    ).toHaveValue('append');

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirty-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          {
            firstName: true,
            keyValue: [{ name: true }, { name: true }, { name: true }],
            lastName: true,
          },
          { firstName: true },
          { firstName: true },
          {
            firstName: true,
            lastName: true,
            keyValue: [{ name: true }, { name: true }],
          },
        ],
      });

    await page.locator('#nest-update-0').click();

    await expect(
      page.locator('input[name="test.0.keyValue.0.name"]'),
    ).toHaveValue('update');

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        test: [
          {
            firstName: 'prepend',
            keyValue: [
              { name: 'update' },
              { name: 'prepend' },
              { name: 'append' },
            ],
          },
          { firstName: 'insert', keyValue: [] },
          { firstName: 'append', keyValue: [] },
          {
            firstName: 'Bill',
            keyValue: [{ name: 'insert' }, { name: 'append' }],
            lastName: 'Luo',
          },
        ],
      });

    await page.locator('#nest-remove-all-3').click();
    await page.locator('#nest-remove-all-2').click();
    await page.locator('#nest-remove-all-1').click();
    await page.locator('#nest-remove-all-0').click();

    await expect(page.locator('#touched-nested-2')).toContainText(
      '{"test":[{"firstName":true,"keyValue":[]},{"firstName":true},{"firstName":true},{"keyValue":[]}]}',
    );

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirty-nested-2').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          {
            firstName: true,
            keyValue: [{ name: true }, { name: true }],
            lastName: true,
          },
          { firstName: true },
          { firstName: true },
          { firstName: true, lastName: true },
        ],
      });

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        test: [
          { firstName: 'prepend', keyValue: [] },
          { firstName: 'insert', keyValue: [] },
          { firstName: 'append', keyValue: [] },
          { firstName: 'Bill', keyValue: [], lastName: 'Luo' },
        ],
      });

    await page.locator('#remove').click();
    await page.locator('#remove').click();
    await page.locator('#remove').click();

    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirty-nested-0').textContent()) || 'null',
        ),
      )
      .toEqual({
        test: [
          {
            firstName: true,
            keyValue: [{ name: true }, { name: true }],
            lastName: true,
          },
        ],
      });

    await page.locator('#submit').click();
    await expect(page.locator('#result')).toContainText(
      '{"test":[{"firstName":"prepend","keyValue":[]}]}',
    );

    await page.locator('#update').click();

    await expect(page.locator('input[name="test.0.firstName"]')).toHaveValue(
      'updateFirstName',
    );
    await expect(
      page.locator('input[name="test.0.keyValue.0.name"]'),
    ).toHaveValue('updateFirstName1');
    await expect(
      page.locator('input[name="test.0.keyValue.1.name"]'),
    ).toHaveValue('updateFirstName2');

    await page.locator('#removeAll').click();

    await expect(page.locator('#dirty-nested-0')).toHaveCount(0);

    await expect(page.locator('#touched-nested-0')).toHaveCount(0);

    await page.locator('#submit').click();
    await expect(page.locator('#result')).toContainText('{"test":[]}');

    await expect(page.locator('#count')).toContainText('17');
  });
});
