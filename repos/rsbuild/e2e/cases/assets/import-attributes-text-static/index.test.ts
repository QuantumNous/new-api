import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

const assetsDir = join(import.meta.dirname, '../../../assets');

test('should import static assets as text with import attributes', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    const assets = await page.evaluate<Record<string, string>>('window.assetText');

    expect(assets.svg).toBe(readFileSync(join(assetsDir, 'circle.svg'), 'utf-8'));
    expect(assets.png).toBe(readFileSync(join(assetsDir, 'icon.png'), 'utf-8'));
  });
});
