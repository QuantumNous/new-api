import type { RsbuildPlugin } from '@rsbuild/core';

export const myPlugin: RsbuildPlugin = {
  name: 'my-plugin',
  setup(api) {
    api.transform({ mimetype: 'text/javascript' }, ({ code }) => {
      return code.replace('data-uri-foo', 'data-uri-bar');
    });
  },
};
