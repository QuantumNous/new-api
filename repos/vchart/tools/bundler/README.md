# @internal/bundler

> 基于 [gulp](https://gulpjs.com/) + [rollup](https://rollupjs.org/introduction/) 封装的专门针对前端库的打包工具，支持 typescript、react、 less 和资源拷贝等能力

# 使用

```
bundle [options] <entry>

# eg.
bundle -f es -w dev --env __DEV__=true --env __ID__="'my_id'"
```

# 命令行参数说明

```
-r, --root <path> 项目根目录(绝对或相对路径) eg. --root /path/to/project
-c, --config <filename> 指定配置文件，默认 <PROJECT_ROOT>/bundler.config.js, eg. --config ./bundler.config.js
--tsconfig <path> tsconfig.json 路径 eg. --tsconfig ./tsconfig.json
-i, --input <filename> 入口文件, 默认 <PROJECT_ROOT>/src/index.ts, eg. --config ./src/index.ts
-f, --formats <format> 指定产物模块类型(umd,es,cjs), eg. -f es -f cjs
-n, --name <name>  UMD 产物中的全局变量名称, 默认取 package name eg. --name MyGlobalName
--copy <ext> 需要拷贝的静态资源文件后缀(umd产物无效), eg. --copy png --copy svg
--less 开启 less 编译支持
-e, --envs <key=value> 要替换的环境变量, eg. --env __DEV__=true --env __ID__="'my_id'"
--clean 删除产物目录
--minify 是否输出压缩后的 UMD 产物文件
-w, --watch 监听文件变化重新构建
-s, --sourcemap 是否生成 sourcemap
--ignorePostTasks, 不执行 postTasks
--ignoreUmdEntries，不执行额外的umd
```

# 配置文件

> 来自命令行参数的字段相比配置文件的相同字段优先级更高, 即可以用命令行参数覆盖配置文件中出现的字段

默认 `<PROJECT_ROOT>/bundler.config.js` 会被 _bundle_ 读取，配置文件需要导出一个配置对象:

```javascript
module.exports = {
  input: {
    es: 'index.es.ts',
    cjs: 'index.cjs.ts',
    umd: 'index.umd.ts'
  },
  formats: ['es', 'cjs', 'umd'],
  outputDir: {
    es: 'es',
    cjs: 'cjs',
    umd: 'dist'
  },
  name: 'MyGlobalName'
  // ...其他配置项
};
```

配置对象类型如下：

```typescript
interface Config {
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
  // 出现编译错误时是否输出产物文件, 如果为true，则会停止构建且不输出任何东西
  noEmitOnError: boolean;
  // 传给给 @babel/preset-env 的 `targets` 字段 see: https://babeljs.io/docs/babel-preset-env#targets
  targets: string | string[] | Record<string, string>;
  // 构建 UMD 产物时，需要排除的模块名称
  external: string[] | ((rawPackageJson: RawPackageJson) => string[]);
  // 构建 UMD 产物时，传递给 @rollup/plugin-alias 作为 entries 的选项
  alias: Array<{ find: string | RegExp; replacement: string; customResolver?: ResolverFunction | ResolverObject }>;
  // 额外的 rollup 配置项
  rollupOptions: Omit<RollupOptions, 'output'>;
  // 构建前执行的任务列表
  preTasks: Record<string, (config: Config, projectRoot: string, rawPackageJson: RawPackageJson) => Promise<unknown>>;
  // 构建后执行的任务列表
  postTasks: Record<string, (config: Config, projectRoot: string, rawPackageJson: RawPackageJson) => Promise<unknown>>;
}
type _ModuleKind = 'es' | 'cjs' | 'umd';
```

# 测试

```shell
rushx dev --root fixtures/config [options]
rushx test
```
