import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.modifyHTMLTags(({ headTags, bodyTags }, { compilation, assetPrefix, filename }) => {
      headTags.push({
        tag: 'script',
        attrs: { id: 'foo', src: `${assetPrefix}foo.js` },
      });

      bodyTags.push({
        tag: 'script',
        attrs: { id: 'bar', src: 'https://cdn.com/bar.js' },
      });

      bodyTags.push({
        tag: 'div',
        children: filename,
      });

      bodyTags.push({
        tag: 'div',
        children: `assets: ${Object.keys(compilation.assets).length}`,
      });

      return { headTags, bodyTags };
    });
  },
};
