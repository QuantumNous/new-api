export const firstBabelPlugin = () => ({
  name: 'first-babel-plugin',
  visitor: {
    Identifier(path: { node: { name?: string } }) {
      const { node } = path;
      if (node?.name === 'aa') {
        node.name = 'bb';
      }
    },
  },
});

export const secondBabelPlugin = () => ({
  name: 'second-babel-plugin',
  visitor: {
    Identifier(path: { node: { name?: string } }) {
      const { node } = path;
      if (node?.name === 'ab') {
        node.name = 'cc';
      }
    },
  },
});
