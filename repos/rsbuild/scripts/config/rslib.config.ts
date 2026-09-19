import { defineConfig, type LibConfig, type Rsbuild } from '@rslib/core';
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong';

export const commonExternals: Array<string | RegExp> = ['webpack', /[\\/]compiled[\\/]/];

export const nodeMinifyConfig: Rsbuild.Minify = {
  js: true,
  css: false,
  jsOptions: {
    minimizerOptions: {
      // preserve variable name and disable minify for easier debugging
      mangle: false,
      minify: false,
      compress: {
        keep_fnames: true,
      },
    },
  },
};

export const esmConfig: LibConfig = {
  syntax: 'es2023',
  dts: {
    isolated: true,
  },
  output: {
    minify: nodeMinifyConfig,
  },
};

export const cjsConfig: LibConfig = {
  format: 'cjs',
  syntax: 'es2023',
  output: {
    minify: nodeMinifyConfig,
  },
};

export const pureEsmPackage = defineConfig({
  lib: [esmConfig],
  tools: {
    rspack: {
      experiments: {
        nativeWatcher: true,
      },
      externals: commonExternals,
    },
  },
  plugins: [
    pluginAreTheTypesWrong({
      enable: Boolean(process.env.CI),
      areTheTypesWrongOptions: {
        // Pure ESM packages are expected to be import-only in Node.
        ignoreRules: ['cjs-resolves-to-esm'],
      },
    }),
  ],
});

export const dualPackage = defineConfig({
  lib: [esmConfig, cjsConfig],
  tools: {
    rspack: {
      experiments: {
        nativeWatcher: true,
      },
      externals: commonExternals,
    },
  },
  plugins: [
    pluginAreTheTypesWrong({
      enable: Boolean(process.env.CI),
      areTheTypesWrongOptions: {
        ignoreRules: [
          // The dual package always provide the ESM types.
          'false-esm',
        ],
      },
    }),
  ],
});
