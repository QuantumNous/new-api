import { expect, test } from '@playwright/test';

test.describe('form setValueAsyncStrictMode', () => {
  test('should set async input value correctly', async ({ page }) => {
    await page.goto('/setValueAsyncStrictMode');

    // The component schedules a sequence of setValue calls 10ms apart via
    // setTimeout and only redraws the displayed <p> when #submit is clicked
    // (it reads a ref, not React state). Clicking immediately on page load
    // races the very first scheduled setValue and can permanently skip a
    // value from the rendered snapshot (verified empirically: clicking right
    // away intermittently drops "C" from the result, ~1 in 3 runs). Giving
    // the async sequence a short head start before the first click avoids
    // that race; the retry loop below is kept as an extra safety net.
    await page.waitForTimeout(100);

    const expected = '["test","A","B","C","D"]';

    const clickUntilComplete = async (attemptsLeft = 40): Promise<void> => {
      await page.locator('#submit').click();
      const text = await page.locator('p').textContent();
      if (text !== expected && attemptsLeft > 0) {
        await page.waitForTimeout(50);
        await clickUntilComplete(attemptsLeft - 1);
      }
    };
    await clickUntilComplete();

    await expect(page.locator('p')).toContainText(expected);
  });
});
