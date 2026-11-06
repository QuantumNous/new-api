import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should import Vue SFC as text with import attributes', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    expect(await page.evaluate('window.vueText')).toBe(
      readFileSync(join(import.meta.dirname, './src/App.vue'), 'utf-8'),
    );
    await expect(page.locator('#normal-vue')).toHaveText('Normal Vue SFC');
  });
});
