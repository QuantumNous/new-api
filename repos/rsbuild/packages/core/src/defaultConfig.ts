import { dirname, isAbsolute, join } from 'node:path';
import {
  ALL_INTERFACES_IPV4,
  ASSETS_DIST_DIR,
  CSS_DIST_DIR,
  DEFAULT_ASSET_PREFIX,
  DEFAULT_DATA_URL_SIZE,
  DEFAULT_MOUNT_ID,
  DEFAULT_PORT,
  DEFAULT_STACK_TRACE,
  FAVICON_DIST_DIR,
  FONT_DIST_DIR,
  HMR_SOCKET_PATH,
  HTML_DIST_DIR,
  IMAGE_DIST_DIR,
  LOCALHOST,
  MEDIA_DIST_DIR,
  ROOT_DIST_DIR,
  SVG_DIST_DIR,
  TS_CONFIG_FILE,
  WASM_DIST_DIR,
} from './constants';
import { getNodeEnv, require } from './helpers';
import { findExists, isFileExists } from './helpers/fs';
import { mergeRsbuildConfig } from './mergeConfig';
import type {
  NormalizedConfig,
  NormalizedDevConfig,
  NormalizedHtmlConfig,
  NormalizedOutputConfig,
  NormalizedPerformanceConfig,
  NormalizedResolveConfig,
  NormalizedSecurityConfig,
  NormalizedServerConfig,
  NormalizedSourceConfig,
  NormalizedToolsConfig,
  PublicDir,
  PublicDirOptions,
  RsbuildConfig,
  RsbuildEntry,
  RsbuildMode,
} from './types';

const getDefaultDevConfig = (): NormalizedDevConfig => ({
  hmr: true,
  liveReload: true,
  browserLogs: {
    stackTrace: DEFAULT_STACK_TRACE,
  },
  watchFiles: [],
  // Temporary placeholder, default: `${server.base}`
  assetPrefix: DEFAULT_ASSET_PREFIX,
  writeToDisk: false,
  cliShortcuts: false,
  client: {
    path: HMR_SOCKET_PATH,
    port: '',
    host: '',
    overlay: true,
    reconnect: 100,
    logLevel: 'info',
  },
});

/**
 * Default allowed origins for CORS.
 * - localhost
 * - 127.0.0.1
 * - [::1]
 *
 * Can be used in `server.cors.origin` config.
 * @example
 * ```ts
 * server: {
 *   cors: {
 *     origin: [defaultAllowedOrigins, 'https://example.com'],
 *   },
 * }
 * ```
 */
export const defaultAllowedOrigins: RegExp =
  /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

const getDefaultServerConfig = (): Omit<NormalizedServerConfig, 'publicDir'> => ({
  port: DEFAULT_PORT,
  host: LOCALHOST,
  open: false,
  base: '/',
  htmlFallback: 'index',
  compress: true,
  printUrls: true,
  strictPort: false,
  cors: {
    origin: defaultAllowedOrigins,
  },
  middlewareMode: false,
});

let swcHelpersPath: string;

const getDefaultSourceConfig = (): NormalizedSourceConfig => {
  return {
    define: {},
    preEntry: [],
    decorators: {
      version: '2023-11',
    },
  };
};

const getDefaultHtmlConfig = (): NormalizedHtmlConfig => ({
  meta: {
    charset: { charset: 'utf-8' },
    viewport: 'width=device-width, initial-scale=1.0',
  },
  title: 'Rsbuild App',
  inject: 'head',
  mountId: DEFAULT_MOUNT_ID,
  crossorigin: false,
  outputStructure: 'flat',
  scriptLoading: 'defer',
  implementation: 'js',
});

const getDefaultSecurityConfig = (): NormalizedSecurityConfig => ({
  nonce: '',
  sri: {
    enable: false,
  },
});

const getDefaultToolsConfig = (): NormalizedToolsConfig => ({
  cssExtract: {
    loaderOptions: {},
    pluginOptions: {
      ignoreOrder: true,
    },
  },
});

const getDefaultPerformanceConfig = (): NormalizedPerformanceConfig => ({
  printFileSize: true,
  removeConsole: false,
});

const getDefaultOutputConfig = (): NormalizedOutputConfig => ({
  target: 'web',
  cleanDistPath: 'auto',
  distPath: {
    root: ROOT_DIST_DIR,
    css: CSS_DIST_DIR,
    svg: SVG_DIST_DIR,
    font: FONT_DIST_DIR,
    html: HTML_DIST_DIR,
    wasm: WASM_DIST_DIR,
    image: IMAGE_DIST_DIR,
    media: MEDIA_DIST_DIR,
    assets: ASSETS_DIST_DIR,
    favicon: FAVICON_DIST_DIR,
  },
  // Temporary placeholder, default: `${server.base}`
  assetPrefix: DEFAULT_ASSET_PREFIX,
  filename: {},
  charset: 'utf8',
  polyfill: 'off',
  dataUriLimit: {
    svg: DEFAULT_DATA_URL_SIZE,
    font: DEFAULT_DATA_URL_SIZE,
    image: DEFAULT_DATA_URL_SIZE,
    media: DEFAULT_DATA_URL_SIZE,
    assets: DEFAULT_DATA_URL_SIZE,
  },
  legalComments: 'linked',
  injectStyles: false,
  manifest: false,
  sourceMap: {
    js: undefined,
    css: false,
    extract: false,
  },
  filenameHash: true,
  inlineScripts: false,
  inlineStyles: false,
  cssModules: {
    auto: true,
    namedExport: false,
    exportGlobals: false,
    exportLocalsConvention: 'camelCase',
  },
  emitAssets: true,
});

const getDefaultResolveConfig = (): NormalizedResolveConfig => {
  if (!swcHelpersPath) {
    swcHelpersPath = dirname(require.resolve('@swc/helpers/package.json'));
  }

  return {
    alias: {
      '@swc/helpers': swcHelpersPath,
    },
    aliasStrategy: 'prefer-tsconfig',
    extensions: [
      // most projects are using TypeScript, resolve .ts(x) files first to reduce resolve time.
      '.ts',
      '.tsx',
      '.mjs',
      '.js',
      '.jsx',
      '.json',
    ],
  };
};

const createDefaultConfig = (): RsbuildConfig => ({
  dev: getDefaultDevConfig(),
  server: getDefaultServerConfig(),
  html: getDefaultHtmlConfig(),
  resolve: getDefaultResolveConfig(),
  source: getDefaultSourceConfig(),
  output: getDefaultOutputConfig(),
  tools: getDefaultToolsConfig(),
  security: getDefaultSecurityConfig(),
  splitChunks: {},
  performance: getDefaultPerformanceConfig(),
  environments: {},
  logLevel: 'info',
});

export function getDefaultEntry(root: string): RsbuildEntry {
  const files = [
    // Most projects are using typescript now.
    // So we put `.ts` as the first one to improve performance.
    'ts',
    'js',
    'tsx',
    'jsx',
    'mts',
    'cts',
    'mjs',
    'cjs',
  ].map((ext) => join(root, `src/index.${ext}`));

  const entryFile = findExists(files);

  if (entryFile) {
    return {
      index: entryFile,
    };
  }

  return {};
}

export const withDefaultConfig = async (
  rootPath: string,
  userConfig: RsbuildConfig,
): Promise<RsbuildConfig> => {
  const config = mergeRsbuildConfig(createDefaultConfig(), userConfig);

  config.root ||= rootPath;
  config.source ||= {};

  // Inherit server.base to output.assetPrefix and dev.assetPrefix if not specified
  if (config.server?.base) {
    if (userConfig.dev?.assetPrefix === undefined) {
      config.dev ||= {};
      config.dev.assetPrefix = config.server.base;
    }

    if (userConfig.output?.assetPrefix === undefined) {
      config.output ||= {};
      config.output.assetPrefix = config.server.base;
    }
  }

  // Inherit logLevel to dev.client.logLevel if not specified
  if (userConfig.dev?.client?.logLevel === undefined) {
    config.dev ||= {};
    config.dev.client ||= {};
    config.dev.client.logLevel = config.logLevel;
  }

  // Enable lazyCompilation imports by default
  if (config.dev?.lazyCompilation === undefined) {
    config.dev ||= {};
    config.dev.lazyCompilation = {
      imports: true,
      entries: false,
    };
  }

  // Auto detect tsconfigPath
  if (!config.source.tsconfigPath) {
    const tsconfigPath = join(rootPath, TS_CONFIG_FILE);

    if (await isFileExists(tsconfigPath)) {
      config.source.tsconfigPath = tsconfigPath;
    }
  }

  return config;
};

/**
 * Normalizes the user configuration by merging it with defaults and ensuring
 * consistent structure.
 */
export const normalizeConfig = (config: RsbuildConfig, rootPath: string): NormalizedConfig => {
  const getMode = (): RsbuildMode => {
    if (config.mode) {
      return config.mode;
    }
    const nodeEnv = getNodeEnv();
    return nodeEnv === 'production' || nodeEnv === 'development' ? nodeEnv : 'none';
  };

  config.server ||= {};
  config.server.host = normalizeHost(config.server.host);
  config.server.publicDir = normalizePublicDirs(rootPath, config.server.publicDir);

  const defaultConfig = createDefaultConfig();
  defaultConfig.mode = getMode();

  const mergedConfig = mergeRsbuildConfig(defaultConfig, config) as NormalizedConfig;

  return mergedConfig;
};

const normalizeHost = (host?: string | boolean): string => {
  if (typeof host === 'string') {
    return host;
  }
  return host === true ? ALL_INTERFACES_IPV4 : LOCALHOST;
};

const normalizePublicDirs = (
  rootPath: string,
  publicDir?: PublicDir,
): Required<PublicDirOptions>[] => {
  if (publicDir === false) {
    return [];
  }

  const defaultConfig: Required<PublicDirOptions> = {
    name: join(rootPath, 'public'),
    copyOnBuild: 'auto',
    watch: false,
    ignore: [],
  };

  // enable public dir by default
  if (publicDir === undefined) {
    return [defaultConfig];
  }

  const mergeWithDefault = (options: PublicDirOptions) => {
    if (options.name === '') {
      throw new Error('[rsbuild:config] `publicDir.name` cannot be empty string.');
    }

    const merged = {
      ...defaultConfig,
      ...options,
    };
    if (!isAbsolute(merged.name)) {
      merged.name = join(rootPath, merged.name);
    }
    return merged;
  };

  if (Array.isArray(publicDir)) {
    return publicDir.map((options) => mergeWithDefault(options));
  }

  return [mergeWithDefault(publicDir)];
};
