import { expect, test } from '@e2e/helper';

test('should return the asset URL with `?url`', async ({ page, buildPreview }) => {
  await buildPreview();

  await expect(
    page.evaluate(`document.getElementById('test-img').src.includes('static/image/icon')`),
  ).resolves.toBeTruthy();
  await expect(
    page.evaluate(
      `document.getElementById('test-img-with-query').src.includes('static/image/icon')`,
    ),
  ).resolves.toBeTruthy();
});
