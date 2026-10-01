import { join } from 'node:path';
import { defineConfig } from '@rsbuild/core';

export const tempConfig = join(import.meta.dirname, 'test-temp-tsconfig.json');

export default defineConfig({
  dev: {
    writeToDisk: true,
  },
  source: {
    tsconfigPath: tempConfig,
  },
  server: {
    port: Number(process.env.PORT),
  },
});
