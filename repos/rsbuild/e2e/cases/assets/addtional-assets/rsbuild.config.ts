import { join } from 'node:path';
import { defineConfig } from '@rsbuild/core';
import fse from 'fs-extra';

fse.outputFileSync(
  join(import.meta.dirname, 'src/assets/test-temp-small.json5'),
  JSON.stringify({ a: 1 }),
);
fse.outputFileSync(
  join(import.meta.dirname, 'src/assets/test-temp-large.json5'),
  JSON.stringify({ a: '1'.repeat(10000) }),
);

export default defineConfig({
  output: {
    filenameHash: false,
  },
});
