import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';


let options = defineConfig([
  // esm
  {
    input: 'src/index.ts',
    output: [
      {
        format: 'esm',
        dir: 'esm',
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        target: 'es6',
        declaration: true,
        declarationDir: 'esm'
      }),
    ]
  },
  // cjs
  {
    input: 'src/index.ts',
    output: [
      {
        format: 'cjs',
        dir: 'cjs',
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        target: 'es6',
        declaration: true,
        declarationDir: 'cjs'
      }),
    ]
  },
  // umd
  {
    input: 'src/index.ts',
    output: [
      {
        format: 'esm',
        dir: 'esm',
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ]
  },
]);

export default options;
