export default {
  source: {
    entry: {
      foo: {
        import: './src/foo.js',
      },
      bar: {
        import: './src/bar.js',
        html: false,
      },
    },
  },
};
