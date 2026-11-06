import { defineConfig, type RsbuildPlugin } from '@rsbuild/core';

const servePlugin: RsbuildPlugin = {
  name: 'serve-plugin',
  apply(config, { action }) {
    return (action === 'dev' || action === 'preview') && config.output?.target === 'web';
  },
  setup(api) {
    api.modifyHTML((html) => {
      return html.replace('</div>', 'serve-plugin</div>');
    });
  },
};

const buildPlugin: RsbuildPlugin = {
  name: 'build-plugin',
  apply(config, { action }) {
    return action === 'build' && config.output?.target === 'web';
  },
  setup(api) {
    api.modifyHTML((html) => {
      return html.replace('</div>', 'build-plugin</div>');
    });
  },
};

export default defineConfig({
  plugins: [servePlugin, buildPlugin],
  output: {
    target: 'web',
  },
});
