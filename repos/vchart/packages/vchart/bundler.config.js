const fs = require('fs');
const path = require('path');
const { visualizer } = require('rollup-plugin-visualizer');
const gzipPlugin = require('rollup-plugin-gzip').default;
const sizes = require('rollup-plugin-sizes');
const bundleSize = require('rollup-plugin-bundle-size');

function copyFile(source, target) {
  try {
    fs.copyFileSync(source, target);
  } catch(err) {
    throw new Error(err);
  }
}

const IGNORE_ENTRIES = process.env.IGNORE_ENTRIES;
const bundle_analyze_mode = process.env.BUNDLE_ANALYZE;
let umdInput = 'index.ts';
let umdOutput = 'index';
if (bundle_analyze_mode && bundle_analyze_mode !== 'full') {
  umdInput = `vchart-${bundle_analyze_mode}.ts`;
  umdOutput = `index-${bundle_analyze_mode}`;
}

const plugins = bundle_analyze_mode
  ? [
      visualizer({
        open: true,
        gzipSize: true,
        emitFile: true,
        filename: `stats-${bundle_analyze_mode}.html`,
        // 可选项：sunburst, treemap, network, raw-data, list.
        template: 'treemap'
      }),
      gzipPlugin({
        filter: /\.(js)$/
      }),
      bundleSize(),
      sizes()
    ]
  : [];

const crossEnvs = bundle_analyze_mode || IGNORE_ENTRIES ? {} : {
  lark: {
    input: 'index-lark',
    output: '../lark-vchart/src/vchart/index.js'
  },
  block: {
    input: 'index-lark',
    output: '../block-vchart/block/vchart/index.js'
  },
  tt: {
    input: 'index-lark',
    output: '../tt-vchart/src/vchart/index.js'
  },
  wx: {
    input: 'index-wx',
    output: '../wx-vchart/miniprogram/src/vchart/index.js'
  },
  'index-wx-simple':{
    input:'index-wx-simple',
    output:'./dist/index-wx-simple.min.js'
  },
};

const esEntries = bundle_analyze_mode || IGNORE_ENTRIES ? [] : ['index-harmony', 'index-harmony-simple'];
const umdEntries = Object.keys(crossEnvs)
  .map(env => crossEnvs[env].input)
  .filter((input, index, arr) => arr.indexOf(input, 0) === index);

const multiEnvRuntimeEntries = new Set(['index-lark', 'index-wx', 'index-wx-simple', ...esEntries]);
const factoryRegistryExternalId = '@visactor/vchart/esm/core/factory-registry';
const vrenderExternalRE = /^@visactor\/vrender(?:-[^/]+)?(?:\/.*)?$/;

function isBrowserRuntimeEntry(entry) {
  const entryName = path.basename(entry, path.extname(entry));
  return !multiEnvRuntimeEntries.has(entryName);
}

function externalizeFactoryRegistryForEsTotal() {
  return {
    name: 'externalize-vchart-factory-registry',
    resolveId(source, importer) {
      if (
        (source === './factory-registry' || source === factoryRegistryExternalId) &&
        importer &&
        path.normalize(importer).endsWith(path.normalize('src/core/factory.ts'))
      ) {
        return {
          id: factoryRegistryExternalId,
          external: true
        };
      }

      return null;
    }
  };
}

/**
 * @type {import('@internal/bundler').Config}
 */
module.exports = {
  name: 'VChart',
  formats: ['es', 'cjs', 'umd'],
  outputDir: {
    es: 'esm',
    cjs: 'cjs',
    umd: 'build'
  },
  esTotalFile: true,
  input: {
    umd: umdInput
  },
  umdOutputFilename: umdOutput,
  noEmitOnError: false,
  envs: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
  },
  rollupOptions: {
    plugins
  },
  esTotalRollupOptions: {
    external: id => vrenderExternalRE.test(id),
    prePlugins: [externalizeFactoryRegistryForEsTotal()]
  },
  nodeResolveOptions: entry =>
    isBrowserRuntimeEntry(entry)
      ? {
          exportConditions: ['browser']
        }
      : {},
  globals: {
    // '@visactor/vrender': 'VRender'
  },
  external: [
    // '@visactor/vrender'
  ],
  umdEntries,
  esEntries,
  postTasks: {
    // generateEntries: (config, projectRoot, rawPackageJson) => {
    //   ['core', 'chart', 'series', 'mark', 'component', 'layout'].forEach(entryName => {
    //     const jsCode = fs.readFileSync(path.join(__dirname, `../../common/template/${entryName}.js`), 'utf-8');
    //     fs.writeFileSync(path.join(__dirname, `./${entryName}.js`), jsCode, 'utf-8');

    //     const dtsCode = fs.readFileSync(path.join(__dirname, `../../common/template/${entryName}.d.ts`), 'utf-8');
    //     fs.writeFileSync(path.join(__dirname, `./${entryName}.d.ts`), dtsCode, 'utf-8');
    //   });
    // },
    copyCrossEnv: (config, projRoot, packageJson, debug) => {
      Object.keys(crossEnvs).forEach(env => {
        const source = `${crossEnvs[env].input}.min.js`;
        const dest = crossEnvs[env].output;
        const envSource = path.join(__dirname, config.outputDir.umd, source);
        copyFile(envSource, path.join(__dirname, dest));

        debug('[copy file] ', `copy ${envSource} to ${path.join(__dirname, dest)}`)
      });
      esEntries.forEach(env => {
        try {
          // harmonyOS
          const source = `${env}.es.min.js`;
          const dest = `../harmony_vchart/library/src/main/ets/${source}`;
          const envSource = path.join(__dirname, config.outputDir.umd, source);
          copyFile(envSource, path.join(__dirname, dest));
          fs.unlinkSync(path.join(__dirname, config.outputDir.umd, source));

          debug('[copy file]', `copy ${envSource} to ${path.join(__dirname, dest)}`)
        } catch(e) {
          debug('[copyCrossEnv Error]', `can't copy es5/index.es.js to harmony`)
        }
      });
      umdEntries.forEach(entry => {
        fs.unlinkSync(path.join(__dirname, config.outputDir.umd, `${entry}.min.js`));
      });
    }
  }
};
