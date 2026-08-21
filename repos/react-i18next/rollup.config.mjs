import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import yargs from 'yargs';

const { argv } = yargs(process.argv);

const format = argv.format || argv.f || 'iife';
const compress = argv.uglify;

const babelOptions = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: ['defaults'],
        },
      },
    ],
    '@babel/react',
  ],
  babelrc: false,
  comments: false,
};

const file = {
  amd: `dist/amd/react-i18next${compress ? '.min' : ''}.js`,
  umd: `dist/umd/react-i18next${compress ? '.min' : ''}.js`,
  iife: `dist/iife/react-i18next${compress ? '.min' : ''}.js`,
}[format];

export default {
  input: 'src/index.js',
  plugins: [
    babel(babelOptions),
    replace({
      'process.env.NODE_ENV': JSON.stringify(compress ? 'production' : 'development'),
    }),
    nodeResolve({ jsnext: true, main: true }),
    commonjs({}),
  ].concat(compress ? terser() : []),
  external: ['react', 'react-dom'],
  // moduleId: 'react-i18next',
  output: {
    name: 'ReactI18next',
    format,
    file,
    globals: {
      react: 'React',
      'react-dom': 'ReactDOM',
    },
  },
};
