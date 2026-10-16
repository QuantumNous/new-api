import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './static/index.html',
    // avoid Minified React error #200
    inject: 'body',
  },
  output: {
    inlineScripts: true,
    inlineStyles: true,
  },
});
