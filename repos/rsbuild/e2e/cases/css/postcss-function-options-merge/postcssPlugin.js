export const postcssPlugin = () => {
  return {
    postcssPlugin: 'simple-postcss-plugin',
    Once(root) {
      root.prepend({
        type: 'atrule',
        name: 'import',
        params: '"tailwindcss"',
      });
    },
  };
};

postcssPlugin.postcss = true;
