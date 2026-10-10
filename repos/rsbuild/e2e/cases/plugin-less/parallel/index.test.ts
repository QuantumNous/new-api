import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should compile less with `parallel` option', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(255, 0, 0)');
    await expect(body).toHaveCSS('font-size', '16px');

    if (mode === 'build') {
      const files = result.getDistFiles();
      const cssContent = getFileContent(files, '.css');
      expect(cssContent).toEqual(
        'body{background-color:red;font-size:16px}div{font-size:14px}h1{font-size:18px;font-weight:700}p{font-size:15px}',
      );
    }
  });
});
