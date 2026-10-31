import { defineConfig, type RsbuildPlugin } from '@rsbuild/core';

const servePlugin: RsbuildPlugin = {
  name: 'serve-plugin',
  apply: 'serve',
  setup(api) {
    api.modifyHTML((html) => {
      return html.replace('</div>', 'serve-plugin</div>');
    });
  },
};

const buildPlugin: RsbuildPlugin = {
  name: 'build-plugin',
  apply: 'build',
  setup(api) {
    api.modifyHTML((html) => {
      return html.replace('</div>', 'build-plugin</div>');
    });
  },
};

export default defineConfig({
  plugins: [servePlugin, buildPlugin],
});
