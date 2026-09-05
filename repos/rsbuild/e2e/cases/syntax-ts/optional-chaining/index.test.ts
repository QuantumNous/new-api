import { expect, test } from '@e2e/helper';

test('should compile optional chaining and nullish coalescing', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    expect(await page.evaluate(() => window.optionalChainingTest)).toBe('john@example.com');
    expect(await page.evaluate(() => window.nullishCoalescingTest)).toBe('No email, fallback');
  });
});
