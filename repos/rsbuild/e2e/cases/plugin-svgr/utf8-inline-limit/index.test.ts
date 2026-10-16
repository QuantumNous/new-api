import { expect, test } from '@e2e/helper';

test('should not inline utf8 SVG when byte length exceeds limit', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();

  await expect(page.evaluate(`document.getElementById('utf8-svg').src`)).resolves.not.toContain(
    'data:image/svg+xml;base64',
  );

  const files = rsbuild.getDistFiles();

  expect(Object.keys(files).some((key) => key.endsWith('.svg'))).toBeTruthy();
});
