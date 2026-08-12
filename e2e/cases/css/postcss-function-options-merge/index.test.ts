import { expect, getFileContent, test } from '@e2e/helper';

test('should merge `postcssOptions` function with `postcss.config.ts` as expected', async ({
  build,
}) => {
  const rsbuild = await build();

  const fooCssExpected =
    '.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}.underline{text-decoration-line:underline}}';
  const barCssExpected =
    '.text-3xl{font-size:var(--text-3xl);line-height:var(--tw-leading,var(--text-3xl--line-height))}}';

  const files = rsbuild.getDistFiles();
  const fooCss = getFileContent(files, 'foo.css');
  expect(fooCss).toContain(fooCssExpected);
  expect(fooCss).not.toContain(barCssExpected);

  const barCss = getFileContent(files, 'bar.css');
  expect(barCss).toContain(barCssExpected);
  expect(barCss).not.toContain(fooCssExpected);
});
