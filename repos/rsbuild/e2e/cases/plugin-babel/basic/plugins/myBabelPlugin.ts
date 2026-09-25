export const myBabelPlugin = () => ({
  name: 'my-babel-plugin',
  visitor: {
    Identifier(path: { node: { name?: string } }) {
      const { node } = path;
      if (node?.name === 'a') {
        node.name = 'b';
      }

      if (node?.name === 'aa') {
        node.name = 'bb';
      }
    },
  },
});
