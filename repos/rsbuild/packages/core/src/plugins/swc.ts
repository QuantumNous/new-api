import fs from 'node:fs';
import path from 'node:path';
import type { SwcLoaderOptions } from '@rspack/core';
import deepmerge from 'deepmerge';
import { reduceConfigs } from 'reduce-configs';
import { NODE_MODULES_REGEX, PLUGIN_SWC_NAME, RAW_QUERY_REGEX, SCRIPT_REGEX } from '../constants';
import { castArray, cloneDeep, color, isFunction, isWebTarget, require } from '../helpers';
import { normalizeRuleConditionPath } from '../helpers/path';
import type {
  NormalizedEnvironmentConfig,
  NormalizedSourceConfig,
  Polyfill,
  RsbuildPlugin,
  RsbuildTarget,
  RspackChain,
  TransformImport,
} from '../types';

const builtinSwcLoaderName = 'builtin:swc-loader';

function applyScriptCondition({
  rule,
  isDev,
  config,
  rsbuildTarget,
}: {
  rule: RspackChain.Rule;
  isDev: boolean;
  config: NormalizedEnvironmentConfig;
  rsbuildTarget: RsbuildTarget;
}): void {
  // compile all modules in the app directory, exclude node_modules
  rule.include.add({ not: NODE_MODULES_REGEX });

  // always compile TS and JSX files.
  // otherwise, it may cause compilation errors and incorrect output
  rule.include.add(/\.(?:ts|tsx|jsx|mts|cts)$/);

  // transform the Rsbuild runtime code to support legacy browsers
  if (rsbuildTarget === 'web' && isDev) {
    rule.include.add(/[\\/]@rsbuild[\\/]core[\\/]dist[\\/]/);
  }

  for (const condition of config.source.include || []) {
    rule.include.add(normalizeRuleConditionPath(condition));
  }

  for (const condition of config.source.exclude || []) {
    rule.exclude.add(normalizeRuleConditionPath(condition));
  }
}

function getDefaultSwcConfig({
  browserslist,
  cacheRoot,
  config,
  isProd,
}: {
  browserslist: string[];
  cacheRoot: string;
  config: NormalizedEnvironmentConfig;
  isProd: boolean;
}): SwcLoaderOptions {
  return {
    detectSyntax: 'auto',
    jsc: {
      externalHelpers: true,
      parser: {
        decorators: true,
      },
      experimental: {
        cacheRoot,
        /**
         * Preserve `with` in imports and exports.
         */
        keepImportAttributes: true,
      },
      output: {
        charset: config.output.charset,
      },
    },
    isModule: 'unknown',
    env: {
      targets: browserslist,
    },
    collectTypeScriptInfo: {
      typeExports: true,
      exportedEnum: isProd,
    },
  };
}

/**
 * Provide some SWC configs of Rspack
 */
export const pluginSwc = (): RsbuildPlugin => ({
  name: PLUGIN_SWC_NAME,

  setup(api) {
    api.modifyBundlerChain({
      order: 'pre',
      handler: async (chain, { CHAIN_ID, isDev, isProd, target, environment }) => {
        const { config, browserslist } = environment;
        const cacheRoot = path.join(api.context.cachePath, '.swc');

        const rule = chain.module
          .rule(CHAIN_ID.RULE.JS)
          .test(SCRIPT_REGEX)
          // When using `new URL('./path/to/foo.js', import.meta.url)`,
          // the module should be treated as an asset module rather than a JS module.
          .dependency({ not: 'url' });

        // Support for `import source from "a.js" with { type: "text" }`
        rule.oneOf(CHAIN_ID.ONE_OF.JS_TEXT).with({ type: 'text' }).type('asset/source');

        // Support for `import rawJs from "a.js?raw"`
        rule.oneOf(CHAIN_ID.ONE_OF.JS_RAW).resourceQuery(RAW_QUERY_REGEX).type('asset/source');

        // Transform TypeScript/JSX/ESNext code
        const mainRule = rule.oneOf(CHAIN_ID.ONE_OF.JS_MAIN).type('javascript/auto');

        const dataUriRule = chain.module.rule(CHAIN_ID.RULE.JS_DATA_URI).mimetype({
          or: ['text/javascript', 'application/javascript'],
        });

        applyScriptCondition({
          rule,
          isDev,
          config,
          rsbuildTarget: target,
        });

        const swcConfig = getDefaultSwcConfig({
          browserslist,
          cacheRoot,
          config,
          isProd,
        });

        applyTransformImport(swcConfig, config.source.transformImport);
        applySwcDecoratorConfig(swcConfig, config);

        // apply polyfill
        if (isWebTarget(target)) {
          const { polyfill } = config.output;

          if (polyfill !== 'off') {
            swcConfig.env!.mode = polyfill;

            const coreJsDir = applyCoreJs(swcConfig, polyfill, api.context.rootPath);
            if (coreJsDir) {
              for (const item of [mainRule, dataUriRule]) {
                item.resolve.alias.set('core-js', coreJsDir);
              }
            }
          }
        }

        const mergedConfig = await reduceConfigs({
          initial: swcConfig,
          config: config.tools.swc,
          mergeFn: deepmerge,
        });

        // `jsc.target` and `env` cannot be set at the same time
        // remove the built-in `env.targets` if `jsc.target` is set
        if (
          mergedConfig.jsc?.target !== undefined &&
          mergedConfig.env?.targets !== undefined &&
          Object.keys(mergedConfig.env).length === 1
        ) {
          delete mergedConfig.env;
        }

        mainRule.use(CHAIN_ID.USE.SWC).loader(builtinSwcLoaderName).options(mergedConfig);

        /**
         * If a script is imported with data URI, it can be compiled by babel too.
         * This is used by some frameworks to create virtual entry.
         * https://rspack.rs/api/runtime-api/module-methods#import
         * @example: import x from 'data:text/javascript,export default 1;';
         */
        dataUriRule.resolve
          // https://github.com/webpack/webpack/issues/11467
          // compatible with legacy packages with type="module"
          .set('fullySpecified', false)
          .end()
          .use(CHAIN_ID.USE.SWC)
          .loader(builtinSwcLoaderName)
          // Using cloned options to keep options separate from each other
          .options(cloneDeep(mergedConfig));
      },
    });
  },
});

const getCoreJsVersion = (corejsPkgPath: string) => {
  try {
    const rawJson = fs.readFileSync(corejsPkgPath, 'utf-8');
    const { version } = JSON.parse(rawJson);
    const [major, minor] = version.split('.');
    return `${major}.${minor}`;
  } catch {
    return '3';
  }
};

const resolveCoreJsPath = (rootPath: string) => {
  try {
    return require.resolve('core-js/package.json', {
      // Resolve from both project root and current directory
      paths: [rootPath, import.meta.dirname],
    });
  } catch {
    throw new Error(
      `${color.dim('[rsbuild:polyfill]')} Failed to resolve ${color.yellow(
        'core-js',
      )} dependency. Install ${color.yellow('core-js >= 3.0.0')} to use polyfills.`,
    );
  }
};

function applyCoreJs(swcConfig: SwcLoaderOptions, polyfillMode: Polyfill, rootPath: string) {
  const coreJsPath = resolveCoreJsPath(rootPath);
  const version = getCoreJsVersion(coreJsPath);
  const coreJsDir = path.dirname(coreJsPath);

  swcConfig.env!.coreJs = version;

  if (polyfillMode === 'usage') {
    // enable esnext polyfill
    // reference: https://github.com/swc-project/swc/blob/b43e38d3f92bc889e263b741dbe173a6f2206d88/crates/swc_ecma_preset_env/src/corejs3/usage.rs#L75
    swcConfig.env!.shippedProposals = true;
  }

  return coreJsDir;
}

const reduceTransformImportConfig = (
  options: NormalizedSourceConfig['transformImport'],
): TransformImport[] => {
  if (!options) {
    return [];
  }

  let imports: TransformImport[] = [];
  for (const item of castArray(options)) {
    if (isFunction(item)) {
      imports = item(imports) ?? imports;
    } else {
      imports.push(item);
    }
  }
  return imports;
};

function applyTransformImport(
  swcConfig: SwcLoaderOptions,
  pluginImport?: NormalizedSourceConfig['transformImport'],
) {
  const finalConfig = reduceTransformImportConfig(pluginImport);
  if (finalConfig?.length) {
    swcConfig.transformImport ??= [];
    swcConfig.transformImport.push(...finalConfig);
  }
}

function applySwcDecoratorConfig(
  swcConfig: SwcLoaderOptions,
  config: NormalizedEnvironmentConfig,
): void {
  swcConfig.jsc ||= {};
  swcConfig.jsc.transform ||= {};

  const { version } = config.source.decorators;

  switch (version) {
    case 'legacy':
      swcConfig.jsc.transform.legacyDecorator = true;
      swcConfig.jsc.transform.decoratorMetadata = true;
      // see: https://github.com/swc-project/swc/issues/6571
      swcConfig.jsc.transform.useDefineForClassFields = false;
      break;
    case '2022-03':
    case '2023-11':
      swcConfig.jsc.transform.legacyDecorator = false;
      swcConfig.jsc.transform.decoratorVersion = version;
      break;
    default:
      throw new Error(
        `${color.dim('[rsbuild:swc]')} Unknown decorators version: ${color.yellow(version)}`,
      );
  }
}
