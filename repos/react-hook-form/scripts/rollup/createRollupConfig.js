import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from 'rollup-plugin-typescript2';

import pkg from '../../package.json';

/**
 *
 * @returns {import("rollup").RollupOptions}
 */
export function createRollupConfig(options, callback) {
  const name = options.name;
  // A file with the extension ".mjs" will always be treated as ESM, even when pkg.type is "commonjs" (the default)
  // https://nodejs.org/docs/latest/api/packages.html#packages_determining_module_system
  const extName = options.format === 'esm' ? 'mjs' : 'js';
  const outputName = 'dist/' + [name, options.format, extName].join('.');

  const config = {
    input: options.input,
    output: {
      file: outputName,
      format: options.format,
      name: 'ReactHookForm',
      sourcemap: true,
      globals: { react: 'React' },
      exports: 'named',
    },
    external: Object.keys(pkg.peerDependencies),
    plugins: [
      typescript({
        clean: true,
        // rpt2 ships with include: ["*.ts+(|x)", "**/*.ts+(|x)", ...] which uses extglob
        // syntax that picomatch v2 (used by @rollup/pluginutils@4.x) does not support —
        // picomatch v2 treats +(|x) as literal characters, so those patterns never match.
        // Override with plain globs that picomatch v2 handles correctly.
        include: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
      }),
      options.format === 'umd' &&
        commonjs({
          include: /\/node_modules\//,
        }),
      options.format !== 'esm' &&
        terser({
          output: { comments: false },
          compress: {
            drop_console: true,
            passes: 2,
            unsafe: false,
            unsafe_comps: false,
            unsafe_math: false,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
          },
        }),
    ].filter(Boolean),
  };

  return callback ? callback(config) : config;
}
