import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.modifyHTMLTags(({ headTags, bodyTags }) => {
      headTags.push({
        tag: 'script',
        attrs: { src: 'https://example.com/script.js' },
        metadata: {
          from: 'my-plugin',
        },
      });

      return { headTags, bodyTags };
    });
  },
};
