import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

const fixtures = ['css', 'less', 'scss', 'sass'] as const;

test('should import style files as text with import attributes', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const styles = await page.evaluate<Record<string, string>>('window.styleText');

    for (const ext of fixtures) {
      expect(styles[ext]).toBe(
        readFileSync(join(import.meta.dirname, `src/style.${ext}`), 'utf-8'),
      );
    }

    expect(await page.evaluate('getComputedStyle(document.body).color')).toBe('rgb(0, 0, 255)');
  });
});
