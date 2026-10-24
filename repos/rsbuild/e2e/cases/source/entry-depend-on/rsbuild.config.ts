export default {
  source: {
    entry: {
      foo: './src/foo.js',
      bar: {
        dependOn: 'foo',
        import: './src/bar.js',
      },
      baz: {
        dependOn: ['foo', 'bar'],
        import: './src/baz.js',
      },
    },
  },
};
