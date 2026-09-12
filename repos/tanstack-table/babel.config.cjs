const { NODE_ENV, BABEL_ENV } = process.env
const cjs = NODE_ENV === 'test' || BABEL_ENV === 'commonjs'
const loose = true

module.exports = {
  targets: 'defaults, not ie 11, not ie_mob 11',
  presets: [
    [
      '@babel/preset-env',
      {
        loose,
        modules: false,
        include: [
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-optional-chaining',
        ],
        // exclude: ['@babel/plugin-transform-regenerator'],
      },
    ],
    '@babel/react',
    '@babel/preset-typescript',
  ],
  plugins: [
    cjs && ['@babel/transform-modules-commonjs', { loose }],
    // [
    //   '@babel/transform-runtime',
    //   {
    //     useESModules: !cjs,
    //     version: require('./package.json').dependencies[
    //       '@babel/runtime'
    //     ].replace(/^[^0-9]*/, ''),
    //   },
    // ],
  ].filter(Boolean),
}
