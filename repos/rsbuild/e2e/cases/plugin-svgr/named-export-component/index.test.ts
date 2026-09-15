import { expect, test } from '@e2e/helper';

test('should render an SVG React component via SVGR (named export)', async ({
  page,
  buildPreview,
}) => {
  await buildPreview();

  await expect(
    page.evaluate(`document.getElementById('test-svg').tagName === 'svg'`),
  ).resolves.toBeTruthy();
});
