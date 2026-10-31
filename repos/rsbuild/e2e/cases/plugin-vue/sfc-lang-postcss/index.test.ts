import { expect, test } from '@e2e/helper';

test('should build Vue SFC with lang="postcss" correctly', async ({ page, buildPreview }) => {
  await buildPreview();

  const button = page.locator('#button');
  await expect(button).toHaveCSS('color', 'rgb(255, 0, 0)');
});
