import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    distPath: `dist/${process.env.FOO}`,
  },
});
