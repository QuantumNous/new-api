import { expect, test } from '@e2e/helper';

test('should import svg with SVGR plugin and query URL correctly', async ({
  page,
  buildPreview,
}) => {
  await buildPreview();

  // test SVG asset
  await expect(
    page.evaluate(`document.getElementById('test-img').src.includes('static/svg/mobile')`),
  ).resolves.toBeTruthy();

  // test SVG asset in CSS
  await expect(
    page.evaluate(
      `getComputedStyle(document.getElementById('test-css')).backgroundImage.includes('static/svg/mobile')`,
    ),
  ).resolves.toBeTruthy();
});
