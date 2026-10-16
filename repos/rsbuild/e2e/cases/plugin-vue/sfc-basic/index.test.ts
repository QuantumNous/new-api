import { expect, test } from '@e2e/helper';

test('should build basic Vue SFC correctly', async ({ page, buildPreview }) => {
  await buildPreview();

  const button1 = page.locator('#button1');
  const button2 = page.locator('#button2');
  const list1 = page.locator('.list1');

  await expect(button1).toHaveText('A: 0');
  await expect(button2).toHaveText('B: 0');
  await expect(list1).toHaveCount(3);
});
