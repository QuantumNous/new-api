import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

const fixtures = ['js', 'jsx', 'ts', 'tsx'] as const;

test('should import script files as text with import attributes', async ({
  page,
  buildPreview,
}) => {
  await buildPreview();

  const scripts = await page.evaluate<Record<string, string>>('window.scriptText');
  const values = await page.evaluate<Record<string, string>>('window.scriptValue');

  for (const ext of fixtures) {
    expect(scripts[ext]).toBe(readFileSync(join(import.meta.dirname, `src/text.${ext}`), 'utf-8'));
    expect(values[ext]).toBe(`${ext} fixture`);
  }
});
