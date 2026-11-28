import { expect, test } from '@e2e/helper';

test('should build solid component with decorators', async ({ page, buildPreview }) => {
  await buildPreview();

  await expect(page.locator('#decorator')).toHaveText('decorator works');
});
