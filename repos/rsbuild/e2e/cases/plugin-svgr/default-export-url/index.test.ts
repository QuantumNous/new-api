import { expect, test } from '@e2e/helper';

test('should import default from SVG with SVGR correctly', async ({ page, buildPreview }) => {
  await buildPreview();

  // test svgr（namedExport）
  await expect(
    page.evaluate(`document.getElementById('component').tagName === 'svg'`),
  ).resolves.toBeTruthy();

  // test SVG asset
  await expect(page.evaluate(`document.getElementById('large-img').src`)).resolves.toMatch(/http:/);

  // test SVG asset
  await expect(
    page.evaluate(`document.getElementById('small-img').src.startsWith('data:image/svg')`),
  ).resolves.toBeTruthy();

  // test SVG asset in CSS
  await expect(
    page.evaluate(
      `getComputedStyle(document.getElementById('test-css-small')).backgroundImage.includes('url("data:image/svg')`,
    ),
  ).resolves.toBeTruthy();
  await expect(
    page.evaluate(
      `getComputedStyle(document.getElementById('test-css-large')).backgroundImage.includes('http:')`,
    ),
  ).resolves.toBeTruthy();
});
