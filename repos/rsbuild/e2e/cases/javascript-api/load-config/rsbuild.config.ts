import { defineConfig } from '@rsbuild/core';

export default defineConfig(({ command }) => ({
  source: {
    define: {
      COMMAND: JSON.stringify(command),
    },
  },
}));
