import { defineConfig } from 'rollup';
import replace from '@rollup/plugin-replace';

import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';

function getPlugins(
  options = {
    es5: true,
    tsconfig: {},
    hasTerser: true,
    hasVisualizer: false
  }
) {
  const { es5, hasTerser, hasVisualizer, tsconfig } = options;
  const result = [
    resolve(),
    commonjs(),
    babel({
      presets: es5 ? [['@babel/preset-env', {
        targets: {
          "chrome": "58",
          "ie": "11" 
        } 
    }]] : undefined,
      babelHelpers: 'bundled',
      compact: false
    }),
    typescript({
      tsconfig: './tsconfig.json',
      target: es5 ? 'es5' : 'es6',
      downlevelIteration: es5 ? true : false,
      ...tsconfig
    }),
    replace({
      __VERSION__: JSON.stringify(pkg.version)
    })
  ];
  hasTerser && result.push(terser());
  return result;
}

let options = defineConfig([
  {
    input: './src/index.ts',
    output: [
      {
        name: 'VChart',
        format: 'umd',
        exports: 'named',
        dir: './build/es5'
      }
    ],
    plugins: [
      ...getPlugins({
        es5: true,
        tsconfig: {
          outDir: './build/es5'
          // declaration: true,
          // declarationDir: './build/es5'
        },
        hasTerser: true
      })
    ]
  }
]);

export default options;
