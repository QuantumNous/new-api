import { JS_REGEX } from '../constants';
import { normalizeRuleConditionPath, toPosixPath } from '../helpers/path';
import type {
  NormalizedEnvironmentConfig,
  RsbuildPlugin,
  Rspack,
  RspackChain,
  SourceMapExtractOptions,
  SourceMapExtractTarget,
} from '../types';

type ExtractRuleConfig = {
  name: string;
  test: Rspack.RuleSetCondition;
  target: SourceMapExtractTarget;
};

const getDevtool = (config: NormalizedEnvironmentConfig): Rspack.DevTool => {
  const { sourceMap } = config.output;
  const isProd = config.mode === 'production';

  if (sourceMap === false) {
    return false;
  }
  if (sourceMap === true) {
    return isProd ? 'source-map' : 'cheap-module-source-map';
  }
  if (sourceMap.js === undefined) {
    return isProd ? false : 'cheap-module-source-map';
  }
  return sourceMap.js;
};

export const pluginSourceMap = (): RsbuildPlugin => ({
  name: 'rsbuild:source-map',

  setup(api) {
    const enableCssSourceMap = (config: NormalizedEnvironmentConfig) => {
      const { sourceMap } = config.output;
      return typeof sourceMap === 'object' && sourceMap.css;
    };

    const normalizeExtractTarget = (
      target: boolean | SourceMapExtractTarget | undefined,
    ): false | SourceMapExtractTarget => {
      if (!target) return false;
      if (target === true) return {};

      return {
        include: target.include?.map(normalizeRuleConditionPath),
        exclude: target.exclude?.map(normalizeRuleConditionPath),
      };
    };

    const normalizeExtractOptions = (
      extract: SourceMapExtractOptions = {},
    ): ExtractRuleConfig | false => {
      const hasLegacyJs = 'js' in extract;
      const hasFlatFields = (['test', 'include', 'exclude'] as const).some(
        (key) => extract[key] !== undefined,
      );

      // TODO: remove legacy `extract.js` support in the next major release.
      // Keep `extract.js: false` as an explicit opt-out for merged configs.
      if (extract.js === false) return false;

      // Preserve the deprecated `extract.js` shape when it is used by itself.
      if (hasLegacyJs && !hasFlatFields) {
        const legacyJs = normalizeExtractTarget(extract.js);
        if (!legacyJs) return false;

        return {
          name: 'source-map-extract-js',
          test: JS_REGEX,
          target: legacyJs,
        };
      }

      const { test, include, exclude } = extract;

      return {
        name: 'source-map-extract',
        test: test ?? JS_REGEX,
        target: {
          include: include?.map(normalizeRuleConditionPath),
          exclude: exclude?.map(normalizeRuleConditionPath),
        },
      };
    };

    const getExtractConfig = (config: NormalizedEnvironmentConfig) => {
      const { sourceMap } = config.output;

      if (typeof sourceMap !== 'object' || !sourceMap.extract) return false;
      if (sourceMap.extract === true) return normalizeExtractOptions();
      if (typeof sourceMap.extract !== 'object') return false;
      return normalizeExtractOptions(sourceMap.extract);
    };

    const applyExtractRule = (chain: RspackChain, extractConfig: ExtractRuleConfig) => {
      const { name, test, target } = extractConfig;
      const rule = chain.module.rule(name).test(test).set('extractSourceMap', true);

      const { include, exclude } = target;
      if (include) {
        for (const condition of include) {
          rule.include.add(condition);
        }
      }

      if (exclude) {
        for (const condition of exclude) {
          rule.exclude.add(condition);
        }
      }
    };

    api.modifyBundlerChain({
      order: 'pre',
      handler: (chain, { environment }) => {
        const extractConfig = getExtractConfig(environment.config);
        if (!extractConfig) return;

        applyExtractRule(chain, extractConfig);
      },
    });

    api.modifyBundlerChain((chain, { rspack, environment, isDev, target }) => {
      const { config } = environment;

      const devtool = getDevtool(config);
      chain.devtool(devtool);

      // Use project-relative POSIX paths in source maps:
      // - Prevents leaking absolute system paths
      // - Keeps maps portable across environments
      // - Matches source map spec and debugger expectations
      let sourceMapTemplate: Rspack.DevtoolModuleFilenameTemplate = '[relative-resource-path]';
      let sourceMapFallbackTemplate: Rspack.DevtoolFallbackModuleFilenameTemplate =
        '[relative-resource-path]?[hash]';

      if (isDev && target === 'web') {
        sourceMapTemplate = (info) => toPosixPath(info.absoluteResourcePath);
        // Use POSIX-style absolute paths in source maps during development
        // This ensures VS Code and browser debuggers can correctly resolve breakpoints
        sourceMapFallbackTemplate = (info) =>
          `${toPosixPath(info.absoluteResourcePath)}?${info.hash}`;
      }

      chain.output
        .devtoolModuleFilenameTemplate(sourceMapTemplate)
        .devtoolFallbackModuleFilenameTemplate(sourceMapFallbackTemplate);

      // When JS source map is disabled, but CSS source map is enabled,
      // add `SourceMapDevToolPlugin` to let Rspack generate CSS source map.
      if (!devtool && enableCssSourceMap(config)) {
        chain.plugin('source-map-css').use(rspack.SourceMapDevToolPlugin, [
          {
            test: /\.css$/,
            filename: '[file].map[query]',
            moduleFilenameTemplate: sourceMapTemplate,
            fallbackModuleFilenameTemplate: sourceMapFallbackTemplate,
          },
        ]);
      }
    });
  },
});
