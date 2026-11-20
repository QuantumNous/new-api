import type {
  PluginItem as BabelPlugin,
  TransformOptions as BabelTransformOptions,
} from '@babel/core';
import type { ConfigChainWithContext } from '@rsbuild/core';

export type { BabelPlugin, BabelTransformOptions };

export type PresetEnvTargets = string | string[] | Record<string, string>;
export type PresetEnvBuiltIns = 'usage' | 'entry' | false;
export type PresetEnvOptions = {
  targets?: PresetEnvTargets;
  bugfixes?: boolean;
  spec?: boolean;
  loose?: boolean;
  modules?: 'amd' | 'umd' | 'systemjs' | 'commonjs' | 'cjs' | 'auto' | false;
  debug?: boolean;
  include?: string[];
  exclude?: string[];
  useBuiltIns?: PresetEnvBuiltIns;
  corejs?: string | { version: string; proposals: boolean };
  forceAllTransforms?: boolean;
  configPath?: string;
  ignoreBrowserslistConfig?: boolean;
  browserslistEnv?: string;
  shippedProposals?: boolean;
};

export interface SharedBabelPresetReactOptions {
  development?: boolean;
  throwIfNamespace?: boolean;
}

export interface AutomaticRuntimePresetReactOptions extends SharedBabelPresetReactOptions {
  runtime?: 'automatic';
  importSource?: string;
}

export interface ClassicRuntimePresetReactOptions extends SharedBabelPresetReactOptions {
  runtime?: 'classic';
  pragma?: string;
  pragmaFrag?: string;
  useBuiltIns?: boolean;
  useSpread?: boolean;
}

export type PresetReactOptions =
  | AutomaticRuntimePresetReactOptions
  | ClassicRuntimePresetReactOptions;

export type RuleCondition = string | RegExp | (string | RegExp)[];

export type BabelConfigUtils = {
  addPlugins: (plugins: BabelPlugin[]) => void;
  addPresets: (presets: BabelPlugin[]) => void;
  removePlugins: (plugins: string | string[]) => void;
  removePresets: (presets: string | string[]) => void;
  modifyPresetEnvOptions: (options: PresetEnvOptions) => void;
  modifyPresetReactOptions: (options: PresetReactOptions) => void;
  /**
   * use `source.include` instead
   * @deprecated
   */
  addIncludes: (includes: RuleCondition) => void;
  /**
   * use `source.exclude` instead
   * @deprecated
   */
  addExcludes: (excludes: RuleCondition) => void;
};

export type BabelLoaderOptions = BabelTransformOptions & {
  /**
   * When set, the given directory will be used to cache the results of the loader.
   */
  cacheDirectory?: string | boolean;
  /**
   * Can be set to a custom value to force cache busting if the identifier changes.
   */
  cacheIdentifier?: string;
  /**
   * When set, each Babel transform output will be compressed with Gzip.
   */
  cacheCompression?: boolean;
  /**
   * The path of a module that exports a custom callback.
   */
  customize?: string | null;
  /**
   * Takes an array of context function names. E.g.
   */
  metadataSubscribers?: string[];
};

export type PluginBabelOptions = {
  /**
   * Used to specify the files that need to be compiled by Babel.
   */
  include?: RuleCondition;
  /**
   * Used to specify the files that do not need to be compiled by Babel.
   */
  exclude?: RuleCondition;
  /**
   * Options passed to `babel-loader`.
   * @see https://github.com/babel/babel-loader
   */
  babelLoaderOptions?: ConfigChainWithContext<BabelLoaderOptions, BabelConfigUtils>;
  /**
   * Whether to run Babel transformations in parallel using worker threads. When
   * enabled, JavaScript modules are processed across multiple worker threads,
   * reducing pressure on the main thread and improving overall build performance
   * when compiling large numbers of modules.
   *
   * Options transferred to worker threads must comply with the HTML structured clone
   * algorithm. For example, functions cannot be passed as options.
   * @see https://nodejs.org/api/worker_threads.html#portpostmessagevalue-transferlist
   * @default false
   */
  parallel?: boolean;
};
