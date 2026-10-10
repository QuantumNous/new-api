import { defineConfig } from '@rsbuild/core';

const addPostcssMarker = () => ({
  postcssPlugin: 'add-postcss-marker',
  Declaration(decl: { prop: string; cloneBefore: (decl: object) => void }) {
    if (decl.prop === 'color') {
      decl.cloneBefore({
        prop: '--postcss-transformed',
        value: 'true',
      });
    }
  },
});

addPostcssMarker.postcss = true;

export default defineConfig({
  output: {
    filenameHash: false,
  },
  tools: {
    postcss(_, { addPlugins }) {
      addPlugins(addPostcssMarker);
    },
  },
});
