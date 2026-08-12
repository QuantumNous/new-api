import { defineConfig } from '@rsbuild/core';

export default defineConfig(({ env, command, envMode }) => ({
  source: {
    define: {
      DEFINED_VALUE: JSON.stringify(`${env}-${envMode}-${command}`),
    },
  },
}));
