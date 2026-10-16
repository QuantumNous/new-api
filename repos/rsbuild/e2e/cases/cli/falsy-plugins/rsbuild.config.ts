import { defineConfig } from '@rsbuild/core';

const anyPlugin = () => ({
  name: 'rsbuild-any-plugin',
  setup() {},
});

export default defineConfig({
  plugins: [anyPlugin(), false, undefined, null],
});
