import { expect, getFileContent, test } from '@e2e/helper';

test('should generate Tailwind utilities from @source files', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    const indexCss = getFileContent(result.getDistFiles(), 'index.css');
    expect(indexCss).toContain('.font-bold');
    expect(indexCss).not.toContain('.underline{');
  });
});
