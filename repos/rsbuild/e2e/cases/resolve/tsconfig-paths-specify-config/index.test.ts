import { expect, test } from '@e2e/helper';

test('should respect tsconfig paths and override the alias config', async ({
  page,
  buildPreview,
}) => {
  await buildPreview();

  const foo = page.locator('#foo');
  await expect(foo).toHaveText('tsconfig paths worked');
});
