import { defineConfig } from '@rsbuild/core';

// rslint-disable-next-line @typescript-eslint/no-require-imports
const browserslist = require('./browserslist.cjs');

export default defineConfig({
  output: {
    filenameHash: false,
    overrideBrowserslist: browserslist,
  },
});
