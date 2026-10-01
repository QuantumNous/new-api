import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should import raw JSON with raw query', async ({ page, buildPreview }) => {
  await buildPreview();

  expect(await page.evaluate('window.a')).toBe(
    readFileSync(join(import.meta.dirname, './src/a.json'), 'utf-8'),
  );
  expect(await page.evaluate('window.b')).toBe(
    readFileSync(join(import.meta.dirname, './src/b.json'), 'utf-8'),
  );
});
