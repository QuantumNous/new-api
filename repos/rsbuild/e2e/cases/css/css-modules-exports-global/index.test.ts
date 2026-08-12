import { expect, getFileContent, test } from '@e2e/helper';

test('should export globals in CSS Modules correctly', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    const test1Locator = page.locator('#test1');
    await expect(test1Locator).toHaveCSS('color', 'rgb(255, 0, 0)');

    const test2Locator = page.locator('#test2');
    await expect(test2Locator).toHaveCSS('color', 'rgb(0, 0, 255)');

    if (mode === 'build') {
      const files = result.getDistFiles();
      const content = getFileContent(files, 'index.css');
      expect(content).toMatch(/\.foo-\w{6}{color:red}\.bar{color:#00f}/);
    }
  });
});
