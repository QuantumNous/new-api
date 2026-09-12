export default {
  source: {
    entry: {
      foo: {
        import: './src/foo.js',
      },
      bar: {
        import: ['./src/bar.js', './src/baz.js'],
      },
      baz: './src/baz.js',
    },
  },
};
