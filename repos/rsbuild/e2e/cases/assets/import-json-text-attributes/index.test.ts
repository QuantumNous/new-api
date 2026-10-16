import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should import JSON as text with import attributes', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    expect(await page.evaluate('window.jsonText')).toBe(
      readFileSync(join(import.meta.dirname, './src/data.json'), 'utf-8'),
    );
    expect(await page.evaluate('window.jsonValue')).toBe('text attributes');
  });
});
