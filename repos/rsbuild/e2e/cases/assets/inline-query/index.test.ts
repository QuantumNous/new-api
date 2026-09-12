import { expect, test } from '@e2e/helper';

test('should inline assets with `?inline`', async ({ page, buildPreview }) => {
  await buildPreview();
  await expect(
    page.evaluate(`document.getElementById('test-img').src.startsWith('data:image/png')`),
  ).resolves.toBeTruthy();
});
