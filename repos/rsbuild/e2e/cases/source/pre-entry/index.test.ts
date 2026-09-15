import { expect, test } from '@e2e/helper';

test('should allow to configure pre-entry', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.innerHTML('#test-el')).resolves.toBe('aaaaa');
    await expect(page.evaluate('window.aa')).resolves.toBe(2);
  });
});
