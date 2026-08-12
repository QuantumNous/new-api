import ArgsParser, { Arguments } from 'yargs-parser';
import type { RawPackageJson } from './package';
import type { RollupOptions } from 'rollup';
import type { Alias } from '@rollup/plugin-alias';
import type { RollupNodeResolveOptions } from '@rollup/plugin-node-resolve';

const stringKeys = ['root', 'config', 'input', 'name', 'tsconfig'];
function getCoerce(keys: string[]) {
  const coerce: { [key: string]: (arg: unknown) => unknown } = {};
  keys.forEach(key => {
    coerce[key] = arg => {
      if (Array.isArray(arg)) {
        return arg[0];
      }
      return arg;
    };
  });
  return coerce;
}

export interface CLIArgs extends Arguments {
  root: string;
  config: string;
  input: string;
  formats: _ModuleKind[];
  name: string;
  sourcemap: boolean;
  watch: boolean;
  envs: string[];
  tsconfig: string;
  less: boolean;
  // dev: boolean;
  clean: boolean;
  minify: boolean;
}
export function parserCLIArgs(argv: string | string[]): Partial<CLIArgs> {
  return ArgsParser(argv, {
    alias: {
      r: 'root',
      c: 'config',
      i: 'input',
      f: 'formats',
      n: 'name',
      s: 'sourcemap',
      w: 'watch',
      e: 'envs',
      m: 'minify'
    },
    array: ['formats', 'envs', 'copy'],
    string: ['config'],
    boolean: ['watch', 'less', 'clean', 'minify', 'sourcemap', 'ignorePostTasks', 'ignoreUmdEntries'],
    coerce: getCoerce(stringKeys)
  });
}

export enum ModuleKind {
  es = 'es',
  cjs = 'cjs',
  umd = 'umd'
}
export type _ModuleKind = keyof typeof ModuleKind;

export interface Config {
  // 项目根路径(相对或绝对路径)
  root: string;
  // 项目源码所在目录(相对路径)
  sourceDir: string;
  // tsconfig.json 所在相对路径
  tsconfig: string;
  // 入口文件相对路径
  input: string | Partial<Record<_ModuleKind, string>>;
  // 输出产物类型
  formats: _ModuleKind[];
  // 输出产物类型相对路径
  outputDir: Partial<Record<_ModuleKind, string>>;
  // UMD 产物中的全局变量名称, 默认取 package name
  name: string;
  // UMD 产物中的文件名称, 默认取 package name
  umdOutputFilename: string;
  // 是否开启sourcemap
  sourcemap: boolean;
  // 开启监听源码模式
  watch: boolean;
  // 要拷贝的静态资源扩展名
  copy: string[];
  // 是否开启  less 编译支持
  less: boolean;
  // 环境变量, 默认会注入版本号`__VERSION__`
  envs: Record<string, string>;
  // 构建开始前，是否清空构建产物目录
  clean: boolean;
  // 是否压缩 umd 产物文件
  minify: boolean;
  // 是否打包出整个的es的文件
  esTotalFile: boolean;
  // 出现编译错误时是否输出产物文件, 如果为true，则会停止构建且不输出任何东西
  noEmitOnError: boolean;
  // 传给给 @babel/preset-env 的 `targets` 字段 see: https://babeljs.io/docs/babel-preset-env#targets
  targets: string | string[] | Record<string, string>;
  // 构建 UMD 产物时，需要排除的模块名称
  external: string[] | ((rawPackageJson: RawPackageJson) => string[]);
  // 构建 UMD 产物时，传递给 @rollup/plugin-alias 作为 entries 的选项
  alias: Array<Alias>;
  // 额外的 rollup 配置项
  rollupOptions: Omit<RollupOptions, 'output'>;
  // 传给 @rollup/plugin-node-resolve 的配置项
  nodeResolveOptions:
    | RollupNodeResolveOptions
    | ((entry: string, config: Config) => RollupNodeResolveOptions | undefined);
  // 构建前执行的任务列表
  preTasks: Record<string, (config: Config, projectRoot: string, rawPackageJson: RawPackageJson) => Promise<unknown>>;
  // 构建后执行的任务列表
  postTasks: Record<
    string,
    (
      config: Config,
      projectRoot: string,
      rawPackageJson: RawPackageJson,
      debug: (...args: any[]) => any
    ) => Promise<unknown>
  >;
  // 全局变量的名称
  globals: Record<string, string>;
  // 额外的 umd 打包入口
  umdEntries: string[];
  esEntries: string[];
}

export const DEFAULT_CONFIG_FILE = 'bundler.config.js';
export function getDefaultConfig(): Config {
  return {
    root: process.cwd(),
    sourceDir: 'src',
    tsconfig: 'tsconfig.json',
    input: {
      es: 'index.ts',
      cjs: 'index.ts',
      umd: 'index.ts'
    },
    esTotalFile: false,
    formats: ['cjs', 'es', 'umd'],
    outputDir: {
      es: 'es',
      cjs: 'cjs',
      umd: 'dist'
    },
    name: '',
    umdOutputFilename: '',
    copy: [],
    sourcemap: true,
    watch: false,
    less: false,
    envs: {},
    // dev: false,
    clean: false,
    minify: true,
    noEmitOnError: true,
    targets: 'defaults and not IE 11',
    external: [],
    alias: [],
    rollupOptions: {},
    nodeResolveOptions: {},
    preTasks: {},
    postTasks: {},
    globals: {},
    umdEntries: [],
    esEntries: []
  };
}

export function loadConfigFile(filePath: string): Partial<Config> {
  try {
    require.resolve(filePath);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`The config file ${filePath} is not exists.`);
    process.exit(1);
  }
  return require(filePath);
}

function parserEnvsOfCLIArgs(envs: string[]): Record<string, boolean | string | number> {
  const _envs: Record<string, boolean | string | number> = {};
  envs.forEach(env => {
    const _s = env.split('=');
    if (Array.isArray(_s) && _s.length) {
      const key = _s[0] as string;
      _envs[key] = _s[1] as boolean | string | number;
    }
  });

  return _envs;
}

function cliArgsToConfig(cliArgs: Partial<CLIArgs>): Partial<Config> {
  const config: Partial<Config> = {};
  Object.keys(cliArgs).forEach(key => {
    if (key === 'envs') {
      return;
    }
    // @ts-ignore
    config[key] = cliArgs[key];
  });
  return config;
}

export function getFinalConfig(
  cliArgs: Partial<CLIArgs>,
  userConfig: Partial<Config>,
  defaultConfig: Config,
  packageVersion: string
): Config {
  const parsedCLIEnvs = parserEnvsOfCLIArgs(cliArgs['envs'] || []);
  const envs = {
    ...userConfig.envs,
    ...parsedCLIEnvs,
    __VERSION__: JSON.stringify(packageVersion)
  };
  return { ...defaultConfig, ...userConfig, ...cliArgsToConfig(cliArgs), envs };
}
