import { expect, test } from '@e2e/helper';

test('should render basic React component', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    const button = page.locator('#button');
    await expect(button).toHaveText('count: 0');
    await button.click();
    await expect(button).toHaveText('count: 1');

    if (mode === 'build') {
      const index = await result.getIndexBundle();
      expect(index).toContain('memo_cache_sentinel');
      const hookStart = index.indexOf('const useCounter = ()=>{');
      expect(hookStart).toBeGreaterThan(-1);
      const hookSnippet = index.slice(hookStart, hookStart + 400);
      expect(hookSnippet).toContain('compiler_runtime.c');
    }
  });
});
