import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should import SVG as text with import attributes when using pluginSvgr', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    expect(await page.evaluate('window.svgText')).toBe(
      readFileSync(join(import.meta.dirname, '../../../assets/circle.svg'), 'utf-8'),
    );
  });
});
