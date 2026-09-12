import { expect, test } from '@e2e/helper';

test('should build a web worker using the new Worker syntax', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#root')).toHaveText(
      'The Answer to the Ultimate Question of Life, The Universe, and Everything: 42',
    );
  });
});
