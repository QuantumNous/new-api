import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { pluginBabel } from '@rsbuild/plugin-babel';

test('should keep raw query imports unchanged with Babel include', async ({
  page,
  buildPreview,
}) => {
  await buildPreview({
    config: {
      plugins: [pluginBabel({ include: /src/ })],
    },
  });

  expect(await page.evaluate('window.rawText')).toBe(
    readFileSync(join(import.meta.dirname, 'src/raw.ts'), 'utf-8'),
  );
  expect(await page.evaluate('window.rawValue')).toBe('raw fixture');
});
