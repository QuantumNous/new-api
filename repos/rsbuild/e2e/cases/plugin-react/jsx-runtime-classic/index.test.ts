import { expect, test } from '@e2e/helper';

test('should render element with classic JSX runtime', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const testEl = page.locator('#test');
    await expect(testEl).toHaveText('Hello Rsbuild!');
  });
});
