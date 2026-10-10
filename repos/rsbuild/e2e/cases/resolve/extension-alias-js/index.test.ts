import fs from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should allow to import TS files with .js extension', async ({ page, buildPreview }) => {
  await buildPreview();
  expect(await page.evaluate(() => window.test)).toBe('ts');
});

test('should resolve the .js file first if both .js and .ts exist', async ({
  page,
  buildPreview,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  fs.writeFileSync(join(tempSrc, 'foo.js'), 'export const foo = "js";');

  await buildPreview({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.ts'),
        },
      },
    },
  });

  expect(await page.evaluate(() => window.test)).toBe('js');
});
