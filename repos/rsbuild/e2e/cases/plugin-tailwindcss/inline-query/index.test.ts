import { expect, test } from '@e2e/helper';

test('should return transformed Tailwind CSS with `?inline`', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const inlineCss = await page.evaluate<string>('window.tailwindInlineCss');

    expect(inlineCss).toContain('.underline');
  });
});
