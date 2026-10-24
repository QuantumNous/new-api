import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should generate Tailwind utilities from source() files', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    const indexCss = getFileContent(result.getDistFiles(), 'index.css');
    expect(indexCss).toContain('.font-bold');
    expect(indexCss).not.toContain('.underline{');
  });
});
