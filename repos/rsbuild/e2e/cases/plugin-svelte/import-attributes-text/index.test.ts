import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should import Svelte files as text with import attributes', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    expect(await page.evaluate('window.svelteText')).toBe(
      readFileSync(join(import.meta.dirname, './src/Text.svelte'), 'utf-8'),
    );
    expect(await page.evaluate('window.svelteTsText')).toBe(
      readFileSync(join(import.meta.dirname, './src/state.svelte.ts'), 'utf-8'),
    );
    await expect(page.locator('#normal-svelte')).toHaveText('Normal Svelte');
  });
});
