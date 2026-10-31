import { expect, test } from '@e2e/helper';

test('should generate Tailwind CSS utilities from Svelte components', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    const title = page.locator('#title');

    await expect(title).toHaveText('Tailwind Svelte');
    await expect(title).toHaveCSS('background-color', 'rgb(101, 67, 33)');
    await expect(title).toHaveCSS('color', 'rgb(255, 255, 255)');
  });
});
