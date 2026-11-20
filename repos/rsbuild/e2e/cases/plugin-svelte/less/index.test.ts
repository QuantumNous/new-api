import { expect, test } from '@e2e/helper';

test('should compile svelte component with less', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const title = page.locator('#title');
    await expect(title).toHaveText('Hello world!');
    // use the text color to assert the compilation result
    await expect(title).toHaveCSS('color', 'rgb(255, 62, 0)');
  });
});
