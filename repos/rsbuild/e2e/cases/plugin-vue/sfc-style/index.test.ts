import { expect, test } from '@e2e/helper';

test('should build Vue SFC style correctly', async ({ page, buildPreview }) => {
  await buildPreview();

  const button = page.locator('#button');
  await expect(button).toHaveCSS('color', 'rgb(255, 0, 0)');

  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(0, 0, 255)');
});
