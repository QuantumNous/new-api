import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should generate manifest file at specified path', async ({ build }) => {
  await build();

  const manifest = join(import.meta.dirname, 'dist', 'custom/my-manifest.json');
  const manifestContent = readFileSync(manifest, 'utf-8');
  expect(manifestContent).toBeDefined();

  const parsed = JSON.parse(manifestContent);

  // index.js, index.html
  expect(Object.keys(parsed.allFiles).length).toBe(2);
});
