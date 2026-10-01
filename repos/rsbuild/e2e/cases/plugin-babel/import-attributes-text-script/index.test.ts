import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { pluginBabel } from '@rsbuild/plugin-babel';

test('should keep text imports unchanged with Babel include', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      plugins: [pluginBabel({ include: /src/ })],
    },
  });

  expect(await page.evaluate('window.scriptText')).toBe(
    readFileSync(join(import.meta.dirname, 'src/text.ts'), 'utf-8'),
  );
  expect(await page.evaluate('window.scriptValue')).toBe('text fixture');
});
