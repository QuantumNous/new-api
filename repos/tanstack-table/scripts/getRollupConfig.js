// @ts-check

import { resolve } from 'node:path'
import { babel } from '@rollup/plugin-babel'
import commonJS from '@rollup/plugin-commonjs'
import { visualizer } from 'rollup-plugin-visualizer'
import terser from '@rollup/plugin-terser'
// @ts-expect-error
import size from 'rollup-plugin-size'
import replace from '@rollup/plugin-replace'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import svelte from 'rollup-plugin-svelte'
import { rootDir } from './config.js'

/** @param {'development' | 'production'} type */
const forceEnvPlugin = type =>
  replace({
    'process.env.NODE_ENV': `"${type}"`,
    delimiters: ['', ''],
    preventAssignment: true,
  })

const babelPlugin = babel({
  configFile: resolve(rootDir, 'babel.config.cjs'),
  babelHelpers: 'bundled',
  exclude: /node_modules/,
  extensions: ['.ts', '.tsx'],
})

/**
 * @param {Object} opts - Options for building configurations.
 * @param {string} opts.name - The name.
 * @param {string} opts.jsName - The UMD name.
 * @param {string} opts.outputFile - The output file.
 * @param {string} opts.entryFile - The entry file.
 * @param {Record<string, string>} opts.globals
 * @param {string[]} opts.external
 * @returns {import('rollup').RollupOptions[]}
 */
export function buildConfigs(opts) {
  const input = resolve(opts.entryFile)

  /** @param {string} moduleName */
  const external = moduleName => opts.external.includes(moduleName)
  const umdExternal = Object.keys(opts.globals)
  const banner = createBanner(opts.name)

  const options = {
    input,
    jsName: opts.jsName,
    outputFile: opts.outputFile,
    external,
    banner,
    globals: opts.globals,
  }

  return [
    mjs(options),
    esm(options),
    cjs(options),
    umdDev({ ...options, external: umdExternal }),
    umdProd({ ...options, external: umdExternal }),
  ]
}

/**
 * @param {Object} opts - Options for building configurations.
 * @param {string} opts.input - The name.
 * @param {string} opts.jsName - The UMD name.
 * @param {string} opts.outputFile - The output file.
 * @param {any} opts.external
 * @param {string} opts.banner - The entry file.
 * @param {Record<string, string>} opts.globals
 * @returns {import('rollup').RollupOptions}
 */
function mjs({ input, external, banner, outputFile }) {
  return {
    // ESM
    external,
    input,
    output: {
      format: 'esm',
      sourcemap: true,
      file: `./build/lib/${outputFile}.mjs`,
      banner,
    },
    plugins: [
      svelte({
        compilerOptions: {
          hydratable: true,
        },
      }),
      commonJS(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
    ],
  }
}

/**
 * @param {Object} opts - Options for building configurations.
 * @param {string} opts.input - The name.
 * @param {string} opts.jsName - The UMD name.
 * @param {string} opts.outputFile - The output file.
 * @param {any} opts.external
 * @param {string} opts.banner - The entry file.
 * @param {Record<string, string>} opts.globals
 * @returns {import('rollup').RollupOptions}
 */
function esm({ input, external, banner, outputFile }) {
  return {
    // ESM
    external,
    input,
    output: {
      format: 'esm',
      sourcemap: true,
      file: `./build/lib/${outputFile}.esm.js`,
      banner,
    },
    plugins: [
      svelte({
        compilerOptions: {
          hydratable: true,
        },
      }),
      commonJS(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
    ],
  }
}

/**
 * @param {Object} opts - Options for building configurations.
 * @param {string} opts.input - The name.
 * @param {string} opts.jsName - The UMD name.
 * @param {string} opts.outputFile - The output file.
 * @param {any} opts.external
 * @param {string} opts.banner - The entry file.
 * @param {Record<string, string>} opts.globals
 * @returns {import('rollup').RollupOptions}
 */
function cjs({ input, external, banner }) {
  return {
    // CJS
    external,
    input,
    output: {
      format: 'cjs',
      sourcemap: true,
      dir: `./build/lib`,
      preserveModules: true,
      exports: 'named',
      banner,
    },
    plugins: [
      svelte(),
      commonJS(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
    ],
  }
}

/**
 * @param {Object} opts - Options for building configurations.
 * @param {string} opts.input - The name.
 * @param {string} opts.jsName - The UMD name.
 * @param {string} opts.outputFile - The output file.
 * @param {any} opts.external
 * @param {string} opts.banner - The entry file.
 * @param {Record<string, string>} opts.globals
 * @returns {import('rollup').RollupOptions}
 */
function umdDev({ input, external, globals, banner, jsName }) {
  return {
    // UMD (Dev)
    external,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `./build/umd/index.development.js`,
      name: jsName,
      globals,
      banner,
    },
    plugins: [
      svelte(),
      commonJS(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      forceEnvPlugin('development'),
    ],
  }
}

/**
 * @param {Object} opts - Options for building configurations.
 * @param {string} opts.input - The name.
 * @param {string} opts.jsName - The UMD name.
 * @param {string} opts.outputFile - The output file.
 * @param {any} opts.external
 * @param {string} opts.banner - The entry file.
 * @param {Record<string, string>} opts.globals
 * @returns {import('rollup').RollupOptions}
 */
function umdProd({ input, external, globals, banner, jsName }) {
  return {
    // UMD (Prod)
    external,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `./build/umd/index.production.js`,
      name: jsName,
      globals,
      banner,
    },
    plugins: [
      svelte(),
      commonJS(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      forceEnvPlugin('production'),
      terser({
        mangle: true,
        compress: true,
      }),
      size({}),
      visualizer({
        filename: `./build/stats-html.html`,
        gzipSize: true,
      }),
      visualizer({
        filename: `./build/stats-react.json`,
        json: true,
        gzipSize: true,
      }),
    ],
  }
}

/** @param {string} libraryName */
function createBanner(libraryName) {
  return `/**
   * ${libraryName}
   *
   * Copyright (c) TanStack
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE.md file in the root directory of this source tree.
   *
   * @license MIT
   */`
}
