import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';

test('should disable loading env files', async ({ execCliSync }) => {
  execCliSync('build --no-env');
  const content = fs.readFileSync(
    path.join(import.meta.dirname, 'dist/static/js/index.js'),
    'utf-8',
  );
  expect(content).toContain('process.env.PUBLIC_NAME');
  expect(content).not.toContain('jack');
});
