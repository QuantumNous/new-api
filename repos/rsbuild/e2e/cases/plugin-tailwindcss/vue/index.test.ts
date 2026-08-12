import { expect, test } from '@e2e/helper';

test('should generate Tailwind CSS utilities from Vue components', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    const title = page.locator('#title');

    await expect(title).toHaveText('Tailwind Vue');
    await expect(title).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(title).toHaveCSS('color', 'rgb(255, 255, 255)');
  });
});
