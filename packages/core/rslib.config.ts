import fs from 'node:fs';
import path from 'node:path';
import { nodeMinifyConfig } from '@scripts/config/rslib.config.ts';
import { defineConfig, type Rsbuild, type Rspack } from '@rslib/core';
import pkgJson from './package.json' with { type: 'json' };
import prebundleConfig from './prebundle.config.ts';

export const define = {
  RSBUILD_VERSION: JSON.stringify(pkgJson.version),
  // `ws` internal env vars
  'process.env.WS_NO_BUFFER_UTIL': true,
  'process.env.WS_NO_UTF_8_VALIDATE': true,
};

const regexpMap: Record<string, RegExp> = {};

for (const item of prebundleConfig.dependencies) {
  const depName = typeof item === 'string' ? item : item.name;

  // Skip dtsOnly dependencies
  if (typeof item !== 'string' && item.dtsOnly) {
    continue;
  }

  regexpMap[depName] = new RegExp(`compiled[\\/]${depName}(?:[\\/]|$)`);
}

const externals: Rspack.Configuration['externals'] = [
  '@rspack/core',
  '@rsbuild/core',
  // yaml and tsx are optional dependencies of `postcss-load-config`
  'yaml',
  'tsx/cjs/api',
  // allow to `require('events')`
  { events: 'node-commonjs node:events' },
  // allow `debug` to require its optional peer dependency
  { 'supports-color': 'node-commonjs supports-color' },
  // externalize pre-bundled dependencies
  ({ request }, callback) => {
    const entries = Object.entries(regexpMap);
    if (request) {
      for (const [name, test] of entries) {
        if (request === name) {
          throw new Error(
            `"${name}" is not allowed to be imported, use "requireCompiledPackage" instead.`,
          );
        }
        if (/jiti/.test(request)) {
          callback(undefined, '../compiled/jiti/lib/jiti.mjs');
          return;
        }
        if (test.test(request)) {
          callback(undefined, `../compiled/${name}/index.js`);
          return;
        }
      }
    }
    callback();
  },
];

const pluginFixDtsTypes: Rsbuild.RsbuildPlugin = {
  name: 'fix-dts-types',
  setup(api) {
    api.onAfterBuild(() => {
      const typesDir = path.join(process.cwd(), 'dist-types');
      const pkgPath = path.join(typesDir, 'package.json');
      if (!fs.existsSync(typesDir)) {
        fs.mkdirSync(typesDir);
      }
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({
          '//': 'This file is for making TypeScript work with moduleResolution nodenext.',
          version: '1.0.0',
        }),
        'utf8',
      );
    });
  },
};

// Rslib currently doesn't provide a way to preserve `__webpack_require__.*`
// references in the emitted bundle.
//
// To work around this, we use "magic" placeholder identifiers during authoring
// (e.g. `RSPACK_INTERCEPT_MODULE_EXECUTION`) so rslib
// won't try to resolve/transform `__webpack_require__.*` at build time.
//
// After bundling, this plugin performs a plain string replacement to swap
// those placeholders back to the actual Rspack runtime globals.
const replacePlugin: Rsbuild.RsbuildPlugin = {
  name: 'replace-plugin',
  setup(api) {
    const RSPACK_INTERCEPT_MODULE_EXECUTION = 'RSPACK_INTERCEPT_MODULE_EXECUTION';

    api.processAssets(
      { stage: 'optimize-inline' },
      ({ assets, compiler, compilation, sources }) => {
        for (const name of Object.keys(assets)) {
          const asset = assets[name];
          if (!name.endsWith('.js')) {
            continue;
          }

          const source = asset.source().toString();
          if (!source.includes(RSPACK_INTERCEPT_MODULE_EXECUTION)) {
            continue;
          }

          const replacedSource = source.replaceAll(
            RSPACK_INTERCEPT_MODULE_EXECUTION,
            compiler.rspack.RuntimeGlobals.interceptModuleExecution,
          );
          compilation.updateAsset(name, new sources.RawSource(replacedSource));
        }
      },
    );
  },
};

export default defineConfig({
  source: {
    define,
  },
  output: {
    externals,
  },
  lib: [
    // Build client modules and copy dependencies to compiled folder
    {
      id: 'prepare',
      syntax: 'es2017',
      source: {
        entry: {
          hmr: 'src/client/hmr.ts',
          overlay: 'src/client/overlay.ts',
        },
        define: {
          // use define to avoid compile time evaluation of import.meta.rspackHash
          BUILD_HASH: 'import.meta.rspackHash',
        },
      },
      output: {
        target: 'web',
        externals: ['./hmr.js'],
        distPath: {
          root: './dist/client',
        },
        copy: {
          patterns: [
            {
              from: './node_modules/jiti',
              to: path.join(import.meta.dirname, 'compiled/jiti'),
              globOptions: {
                dot: false,
              },
            },
          ],
        },
      },
      performance: {
        printFileSize: {
          exclude: (asset) => /compiled/.test(asset.name),
        },
      },
      plugins: [replacePlugin],
    },
    {
      id: 'node',
      syntax: 'es2023',
      plugins: [pluginFixDtsTypes],
      source: {
        entry: {
          index: './src/index.ts',
          cssUrlLoader: './src/loader/cssUrlLoader.ts',
          ignoreCssLoader: './src/loader/ignoreCssLoader.ts',
          transformLoader: './src/loader/transformLoader.ts',
          transformRawLoader: './src/loader/transformRawLoader.ts',
          workerLoader: './src/loader/workerLoader.ts',
        },
      },
      dts: {
        isolated: true,
        alias: {
          // alias to pre-bundled types as they are public API
          cors: './compiled/cors',
          rslog: './compiled/rslog',
          postcss: './compiled/postcss',
          chokidar: './compiled/chokidar',
          'connect-next': './compiled/connect-next',
          'rspack-chain': './compiled/rspack-chain/types',
          'html-rspack-plugin': './compiled/html-rspack-plugin',
          'http-proxy-middleware': './compiled/http-proxy-middleware',
          'rspack-manifest-plugin': './compiled/rspack-manifest-plugin',
        },
      },
      output: {
        minify: nodeMinifyConfig,
        filename: {
          js: ({ chunk }) => {
            // Use `.mjs` for Rspack loaders
            if (chunk?.name?.endsWith('Loader')) {
              return '[name].mjs';
            }
            return `[name].js`;
          },
        },
      },
      shims: {
        esm: {
          // For `postcss-load-config`
          __filename: true,
        },
      },
      tools: {
        rspack: {
          // Wait the pre compiler to copy jiti to compiled folder
          dependencies: ['prepare'],
        },
      },
    },
  ],
});
