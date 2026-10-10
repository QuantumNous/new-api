import { expect, test } from '@e2e/helper';

const utf8Str = `你好 world! I'm 🦀`;

test('should resolve emoji filename', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    expect(await page.evaluate('window.test')).toBe(utf8Str);

    if (mode === 'build') {
      const content = await result.getIndexBundle();
      expect(content.includes(utf8Str)).toBeTruthy();
    }
  });
});
