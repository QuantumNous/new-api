import { expect, getFileContent, test } from '@e2e/helper';

test('should load postcss.config.ts correctly', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const indexCss = getFileContent(files, 'index.css');
  expect(indexCss).toContain(
    '.text-3xl{font-size:var(--text-3xl);line-height:var(--tw-leading,var(--text-3xl--line-height))}',
  );
  expect(indexCss).toContain(
    '.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}',
  );
  expect(indexCss).toContain('.underline{text-decoration-line:underline}');
});
