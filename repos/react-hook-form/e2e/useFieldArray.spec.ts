import { expect, test } from '@playwright/test';

import { type } from './utils';

test.describe('useFieldArray', () => {
  test('should behaviour correctly without defaultValues', async ({ page }) => {
    await page.goto('/useFieldArray/normal');

    await page.locator('#append').click();
    await expect(page.locator('ul > li')).toHaveCount(1);

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '3' }],
      });

    await page.locator('#prepend').click();
    await expect(page.locator('ul > li')).toHaveCount(2);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '7',
    );

    await page.locator('#append').click();
    await expect(page.locator('ul > li')).toHaveCount(3);

    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      '9',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '7' }, { name: '3' }, { name: '9' }],
      });

    await page.locator('#swap').click();
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '9',
    );
    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      '3',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '7' }, { name: '9' }, { name: '3' }],
      });

    await page.locator('#move').click();
    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '3',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '7',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '3' }, { name: '7' }, { name: '9' }],
      });

    await page.locator('#insert').click();
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '19',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '3' }, { name: '19' }, { name: '7' }, { name: '9' }],
      });

    await page.locator('#remove').click();
    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '3',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '7',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '3' }, { name: '7' }, { name: '9' }],
      });

    await page.locator('#delete1').click();

    await expect(page.locator('ul > li')).toHaveCount(2);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '3',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '9',
    );

    await page.locator('#delete1').click();

    await expect(page.locator('ul > li')).toHaveCount(1);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '3',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '3' }],
      });

    await page.locator('#update').click();

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'changed',
    );

    await page.locator('#removeAll').click();
    await expect(page.locator('ul > li')).toHaveCount(0);

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [],
      });

    await page.locator('#append').click();
    await page.locator('#append').click();
    await page.locator('#append').click();

    await page.locator('#removeAsync').click();
    await page.locator('#removeAsync').click();

    await expect(page.locator('input')).toHaveCount(1);

    await page.locator('#submit').click();

    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: '34' }],
      });

    await expect(page.locator('#renderCount')).toContainText('44');
  });

  test('should behaviour correctly with defaultValue', async ({ page }) => {
    await page.goto('/useFieldArray/default');

    await expect(page.locator('ul > li')).toHaveCount(3);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );

    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      'test1',
    );

    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      'test2',
    );

    await page.locator('#append').click();

    await expect(page.locator('ul > li').nth(3).locator('input')).toHaveValue(
      '3',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#prepend').click();
    await expect(page.locator('ul > li')).toHaveCount(5);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '7',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '7' },
          { name: 'test' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#swap').click();
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      'test1',
    );
    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      'test',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '7' },
          { name: 'test1' },
          { name: 'test' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#move').click();
    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '7',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: '7' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#insert').click();
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '17',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: '17' },
          { name: '7' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#remove').click();
    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '7',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: '7' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#delete2').click();

    await expect(page.locator('ul > li')).toHaveCount(4);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '7',
    );
    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      'test2',
    );
    await expect(page.locator('ul > li').nth(3).locator('input')).toHaveValue(
      '3',
    );

    await page.locator('#delete3').click();

    await expect(page.locator('ul > li')).toHaveCount(3);

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: 'test' }, { name: '7' }, { name: 'test2' }],
      });

    await page.locator('#removeAll').click();
    await expect(page.locator('ul > li')).toHaveCount(0);

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [],
      });

    await page.locator('#append').click();

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '31',
    );

    await page.locator('#prepend').click();

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '33',
    );

    await expect(page.locator('#renderCount')).toContainText('34');
  });

  test('should behaviour correctly with defaultValue and without auto focus', async ({
    page,
  }) => {
    await page.goto('/useFieldArray/defaultAndWithoutFocus');

    await expect(page.locator('ul > li')).toHaveCount(3);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );

    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      'test1',
    );

    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      'test2',
    );

    await page.locator('#append').click();

    await expect(page.locator('ul > li').nth(3).locator('input')).toHaveValue(
      '3',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#prepend').click();
    await expect(page.locator('ul > li')).toHaveCount(5);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '6',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '6' },
          { name: 'test' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#swap').click();
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      'test1',
    );
    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      'test',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '6' },
          { name: 'test1' },
          { name: 'test' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#move').click();
    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '6',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: '6' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#insert').click();
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '15',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: '15' },
          { name: '6' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#remove').click();
    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '6',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: 'test' },
          { name: '6' },
          { name: 'test1' },
          { name: 'test2' },
          { name: '3' },
        ],
      });

    await page.locator('#delete2').click();

    await expect(page.locator('ul > li')).toHaveCount(4);

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      'test',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '6',
    );
    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      'test2',
    );
    await expect(page.locator('ul > li').nth(3).locator('input')).toHaveValue(
      '3',
    );

    await page.locator('#delete3').click();

    await expect(page.locator('ul > li')).toHaveCount(3);

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [{ name: 'test' }, { name: '6' }, { name: 'test2' }],
      });

    await page.locator('#removeAll').click();
    await expect(page.locator('ul > li')).toHaveCount(0);

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [],
      });

    await page.locator('#append').click();

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '28',
    );

    await page.locator('#prepend').click();

    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '29',
    );

    await expect(page.locator('#renderCount')).toContainText('30');
  });

  test('should replace fields with new values', async ({ page }) => {
    await page.goto('/useFieldArray/normal');
    await page.locator('#replace').click();
    await expect(page.locator('ul > li').nth(0).locator('input')).toHaveValue(
      '3. lorem',
    );
    await expect(page.locator('ul > li').nth(1).locator('input')).toHaveValue(
      '3. ipsum',
    );
    await expect(page.locator('ul > li').nth(2).locator('input')).toHaveValue(
      '3. dolor',
    );
    await expect(page.locator('ul > li').nth(3).locator('input')).toHaveValue(
      '3. sit amet',
    );

    await page.locator('#submit').click();
    await expect
      .poll(async () =>
        JSON.parse((await page.locator('#result').textContent()) || 'null'),
      )
      .toEqual({
        data: [
          { name: '3. lorem' },
          { name: '3. ipsum' },
          { name: '3. dolor' },
          { name: '3. sit amet' },
        ],
      });
  });

  test('should display the correct dirty value with default value', async ({
    page,
  }) => {
    await page.goto('/useFieldArray/default');
    await expect(page.locator('#dirty')).toContainText('no');
    await page.locator('#update').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, null, null],
      });
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#updateRevert').click();
    await expect(page.locator('#dirty')).toContainText('no');
    await page.locator('#append').click();
    await type(page.locator('#field1'), 'test');
    await page.locator('#prepend').click();
    await page.locator('#delete2').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, { name: true }, null, { name: true }],
      });
    await page.locator('#delete2').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, { name: true }, { name: true }],
      });
    await page.locator('#delete1').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, { name: true }, { name: true }],
      });
    await page.locator('#delete1').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, { name: true }, { name: true }],
      });
    await page.locator('#delete0').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, { name: true }, { name: true }],
      });
    await expect(page.locator('#dirty')).toContainText('yes');
    await expect(page.locator('#renderCount')).toContainText('16');
  });

  test('should display the correct dirty value without default value', async ({
    page,
  }) => {
    await page.goto('/useFieldArray/normal');
    await expect(page.locator('#dirty')).toContainText('no');
    await page.locator('#append').click();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#field0').focus();
    await page.locator('#field0').blur();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }],
      });
    await expect(page.locator('#dirty')).toContainText('yes');
    await type(page.locator('#field0'), 'test');
    await page.locator('#field0').blur();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#prepend').click();
    await page.locator('#prepend').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, { name: true }, { name: true }],
      });
    await page.locator('#delete0').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }, { name: true }],
      });

    await page.locator('#delete1').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({
        data: [{ name: true }],
      });

    await page.locator('#delete0').click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.locator('#dirtyFields').textContent()) || 'null',
        ),
      )
      .toEqual({});

    await expect(page.locator('#dirty')).toContainText('yes');
  });

  test('should display the correct dirty value with default value (revert on clear+retype)', async ({
    page,
  }) => {
    await page.goto('/useFieldArray/default');
    await expect(page.locator('#dirty')).toContainText('no');
    await page.locator('#field0').focus();
    await page.locator('#field0').blur();
    await expect(page.locator('#dirty')).toContainText('no');
    await type(page.locator('#field0'), 'test');
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#field0').blur();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#field0').focus();
    await page.locator('#field0').blur();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#field0').clear();
    await type(page.locator('#field0'), 'test');
    await expect(page.locator('#dirty')).toContainText('no');
    await page.locator('#delete1').click();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#append').click();
    await page.locator('#field0').clear();
    await type(page.locator('#field0'), 'test');
    await page.locator('#field1').clear();
    await type(page.locator('#field1'), 'test1');
    await page.locator('#field2').clear();
    await type(page.locator('#field2'), 'test2');
    await expect(page.locator('#dirty')).toContainText('no');
  });

  test('should display the correct dirty value with async default value', async ({
    page,
  }) => {
    await page.goto('/useFieldArray/asyncReset');
    await expect(page.locator('#dirty')).toContainText('no');
    await page.locator('#field0').focus();
    await page.locator('#field0').blur();
    await expect(page.locator('#dirty')).toContainText('no');
    await type(page.locator('#field0'), 'test');
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#field0').blur();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#field0').focus();
    await page.locator('#field0').blur();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#field0').clear();
    await type(page.locator('#field0'), 'test');
    await expect(page.locator('#dirty')).toContainText('no');
    await page.locator('#delete1').click();
    await expect(page.locator('#dirty')).toContainText('yes');
    await page.locator('#append').click();
    await page.locator('#field0').clear();
    await type(page.locator('#field0'), 'test');
    await page.locator('#field1').clear();
    await type(page.locator('#field1'), 'test1');
    await page.locator('#field2').clear();
    await type(page.locator('#field2'), 'test2');
    await expect(page.locator('#dirty')).toContainText('no');
  });

  test('should display correct error with the inputs', async ({ page }) => {
    await page.goto('/useFieldArray/default');
    await page.locator('#prepend').click();
    await page.locator('#field1').clear();
    await page.locator('#field2').clear();
    await page.locator('#field3').clear();
    await page.locator('#append').click();
    await page.locator('#submit').click();
    await expect(page.locator('#error1')).toContainText('This is required');
    await expect(page.locator('#error2')).toContainText('This is required');
    await expect(page.locator('#error3')).toContainText('This is required');
    await type(page.locator('#field1'), 'test');
    await expect(page.locator('#error1')).toHaveCount(0);
    await expect(page.locator('#error2')).toContainText('This is required');
    await expect(page.locator('#error3')).toContainText('This is required');
    await page.locator('#move').click();
    await expect(page.locator('#error0')).toContainText('This is required');
    await expect(page.locator('#error2')).toHaveCount(0);
    await page.locator('#prepend').click();
    await expect(page.locator('#error0')).toHaveCount(0);
    await expect(page.locator('#error1')).toContainText('This is required');
  });

  test('should return correct touched values', async ({ page }) => {
    await page.goto('/useFieldArray/default');
    await type(page.locator('#field0'), '1');
    await type(page.locator('#field1'), '1');
    await type(page.locator('#field2'), '1');
    await expect(page.locator('#touched')).toContainText(
      '[{"name":true},{"name":true}]',
    );
    await page.locator('#append').click();
    await page.locator('#prepend').click();
    await expect(page.locator('#touched')).toContainText(
      '[null,{"name":true},{"name":true},{"name":true},{"name":true}]',
    );
    await page.locator('#insert').click();
    await expect(page.locator('#touched')).toContainText(
      '[{"name":true},null,{"name":true},{"name":true},{"name":true},{"name":true}]',
    );
    await page.locator('#swap').click();
    await expect(page.locator('#touched')).toContainText(
      '[{"name":true},{"name":true},{"name":true},{"name":true},{"name":true},{"name":true}]',
    );
    await page.locator('#move').click();
    await expect(page.locator('#touched')).toContainText(
      '[{"name":true},{"name":true},{"name":true},{"name":true},{"name":true},{"name":true}]',
    );
    await page.locator('#insert').click();
    await expect(page.locator('#touched')).toContainText(
      '[{"name":true},null,{"name":true},{"name":true},{"name":true},{"name":true},{"name":true}]',
    );
    await page.locator('#delete4').click();
    await expect(page.locator('#touched')).toContainText(
      '[{"name":true},{"name":true},{"name":true},{"name":true},{"name":true},{"name":true}]',
    );
  });

  test('should return correct touched values without autoFocus', async ({
    page,
  }) => {
    await page.goto('/useFieldArray/defaultAndWithoutFocus');
    await type(page.locator('#field0'), '1');
    await type(page.locator('#field1'), '1');
    await type(page.locator('#field2'), '1');
    await expect(page.locator('#touched')).toContainText(
      '[{"name":true},{"name":true}]',
    );
    await page.locator('#append').click();
    await page.locator('#prepend').click();
    await expect(page.locator('#touched')).toContainText(
      '[null,{"name":true},{"name":true},{"name":true},null]',
    );
    await page.locator('#insert').click();
    await expect(page.locator('#touched')).toContainText(
      '[null,null,{"name":true},{"name":true},{"name":true},null]',
    );
    await page.locator('#swap').click();
    await expect(page.locator('#touched')).toContainText(
      '[null,{"name":true},null,{"name":true},{"name":true},null]',
    );
    await page.locator('#move').click();
    await expect(page.locator('#touched')).toContainText(
      '[null,null,{"name":true},{"name":true},{"name":true},null]',
    );
    await page.locator('#insert').click();
    await expect(page.locator('#touched')).toContainText(
      '[null,null,null,{"name":true},{"name":true},{"name":true},null]',
    );
    await page.locator('#delete4').click();
    await expect(page.locator('#touched')).toContainText(
      '[null,null,null,{"name":true},{"name":true},null]',
    );
  });

  test('should return correct isValid formState', async ({ page }) => {
    await page.goto('/useFieldArray/formState');
    await expect(page.locator('#isValid')).toContainText('yes');
    await page.locator('#append').click();
    await page.locator('#append').click();
    await page.locator('#append').click();

    await expect(page.locator('#isValid')).toContainText('yes');

    await page.locator('#field0').clear();

    await expect(page.locator('#isValid')).toContainText('no');

    await page.locator('#delete0').click();
    await type(page.locator('#field1'), '1');

    await expect(page.locator('#isValid')).toContainText('yes');

    await page.locator('#field0').clear();

    await expect(page.locator('#isValid')).toContainText('no');

    // introduced by react 19 with race condition with blur and useEffect action
    await page.locator('#field0').blur();

    await page.locator('#delete0').click();

    await expect(page.locator('#isValid')).toContainText('yes');

    await page.locator('#append').click();
    await page.locator('#field0').clear();

    await expect(page.locator('#isValid')).toContainText('no');

    await page.locator('#delete0').click();

    await expect(page.locator('#isValid')).toContainText('yes');

    await page.locator('#append').click();
    await page.locator('#append').click();

    await page.locator('#field1').clear();
    await page.locator('#field2').clear();

    await expect(page.locator('#isValid')).toContainText('no');

    await page.locator('#delete1').click();
    await page.locator('#delete1').click();

    await expect(page.locator('#isValid')).toContainText('yes');
  });
});
