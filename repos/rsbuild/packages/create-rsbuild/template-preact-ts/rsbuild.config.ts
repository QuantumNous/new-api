import { defineConfig } from '@rsbuild/core';
import { pluginPreact } from '@rsbuild/plugin-preact';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginPreact()],
});
