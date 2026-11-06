import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';

test('should allow to custom env prefix via loadEnv method', async ({ execCliSync }) => {
  execCliSync('build');
  const content = fs.readFileSync(
    path.join(import.meta.dirname, 'dist/static/js/index.js'),
    'utf-8',
  );
  expect(content).not.toContain('jack');
  expect(content).toContain('rose');
});
