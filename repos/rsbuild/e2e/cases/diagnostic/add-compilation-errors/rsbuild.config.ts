import { defineConfig, type Rspack } from '@rsbuild/core';

export default defineConfig({
  tools: {
    rspack: {
      plugins: [
        {
          apply: (compiler: Rspack.Compiler) => {
            compiler.hooks.thisCompilation.tap('ThisCompilationPlugin', (compilation) => {
              compilation.errors.push(new Error('Something went wrong'));
            });
          },
        },
      ],
    },
  },
});
