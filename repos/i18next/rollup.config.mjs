import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

const babelOptions = {
  exclude: /node_modules/,
  babelHelpers: 'bundled',
  comments: false,
};

const input = './src/index.js';
const inputCjs = './src/index.cjs';
const name = 'i18next';
// check relative and absolute paths for windows and unix
const external = (id) => !id.startsWith('.') && !id.startsWith('/') && !id.includes(':');

export default [
  {
    input: inputCjs,
    output: { format: 'cjs', file: pkg.main },
    external,
    plugins: [babel(babelOptions)],
  },

  {
    input,
    output: { format: 'esm', file: pkg.module },
    external,
    plugins: [babel(babelOptions)],
  },

  {
    input: inputCjs,
    output: { format: 'umd', name, file: `dist/umd/${name}.js` },
    plugins: [babel(babelOptions), nodeResolve()],
  },
  {
    input: inputCjs,
    output: { format: 'umd', name, file: `dist/umd/${name}.min.js` },
    plugins: [babel(babelOptions), nodeResolve(), terser()],
  },
];
