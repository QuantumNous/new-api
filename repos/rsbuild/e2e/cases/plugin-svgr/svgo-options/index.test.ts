import { expect, test } from '@e2e/helper';

test('should use SVGR and override SVGO plugin options', async ({ page, buildPreview }) => {
  await buildPreview();

  await expect(
    page.evaluate(`document.getElementById('test-svg').tagName === 'svg'`),
  ).resolves.toBeTruthy();
});
