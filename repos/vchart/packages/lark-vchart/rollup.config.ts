import { defineConfig } from 'rollup';

import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

let options = defineConfig([
  {
    input: './src/index.js',
    output: [
      {
        format: 'umd',
        file: 'index.js'
      }
    ],
    plugins: [
      resolve(),
      commonjs({
        include: './src/vchart/index.js',
        ignore: ['./shadow-root', '../common/xml/parser']
      }),
      babel({
        presets: [['@babel/preset-env']],
        babelHelpers: 'bundled'
      }),
      terser(),
      copy({
        targets: [
          {
            src: ['src/index.json', 'src/index.ttml', 'src/index.ttss'],
            dest: './'
          }
        ]
      })
    ]
  }
]);

export default options;
