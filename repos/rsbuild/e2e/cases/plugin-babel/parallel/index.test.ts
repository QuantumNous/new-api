import { expect, test } from '@e2e/helper';

test('should compile JavaScript with parallel Babel loader', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    expect(await page.evaluate('window.parallelBabelMessages')).toEqual(
      Array.from({ length: 5 }, () => 'compiled by parallel babel-loader'),
    );
  });
});
