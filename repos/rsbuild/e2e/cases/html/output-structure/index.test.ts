import fs from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@e2e/helper';

test('should output nested HTML structure when html.outputStructure is `nested`', async ({
  build,
}) => {
  const rsbuild = await build();

  const pagePath = join(rsbuild.distPath, 'index/index.html');

  expect(fs.existsSync(pagePath)).toBeTruthy();
});

test('should output nested HTML for multiple entries', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          foo: './src/foo.js',
          bar: './src/bar.js',
        },
      },
      output: {
        filenameHash: false,
      },
    },
  });

  for (const entry of ['foo', 'bar']) {
    const pagePath = join(rsbuild.distPath, entry, 'index.html');
    const html = await fs.promises.readFile(pagePath, 'utf-8');

    expect(html).toContain(`/static/js/${entry}.js`);
  }
});
