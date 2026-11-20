import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';

test('should inject public env vars to client', async ({ execCliSync }) => {
  execCliSync('build');

  const content = fs.readFileSync(
    path.join(import.meta.dirname, 'dist/static/js/index.js'),
    'utf-8',
  );
  expect(content).not.toContain('jack');
  expect(content).toContain('"process.env","rose"');
  expect(content).toContain('"import.meta.env","rose"');
});
