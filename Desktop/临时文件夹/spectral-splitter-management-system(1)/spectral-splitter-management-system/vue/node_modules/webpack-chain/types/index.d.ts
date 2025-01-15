import { Tapable } from 'tapable';
import * as webpack from 'webpack';
import * as https from 'https';

export = Config;

declare namespace __Config {
  class Chained<Parent> {
    end(): Parent;
  }

  class TypedChainedMap<Parent, Value> extends Chained<Parent> {
    clear(): this;
    delete(key: string): this;
    has(key: string): boolean;
    get(key: string): Value;
    getOrCompute(key: string, compute: () => Value): Value;
    set(key: string, value: Value): this;
    merge(obj: { [key: string]: Value }): this;
    entries(): { [key: string]: Value };
    values(): Value[];
    when(
      condition: boolean,
      trueBrancher: (obj: this) => void,
      falseBrancher?: (obj: this) => void,
    ): this;
  }

  class ChainedMap<Parent> extends TypedChainedMap<Parent, any> {}

  class TypedChainedSet<Parent, Value> extends Chained<Parent> {
    add(value: Value): this;
    prepend(value: Value): this;
    clear(): this;
    delete(key: string): this;
    has(key: string): boolean;
    merge(arr: Value[]): this;
    values(): Value[];
    when(
      condition: boolean,
      trueBrancher: (obj: this) => void,
      falseBrancher?: (obj: this) => void,
    ): this;
  }

  class ChainedSet<Parent> extends TypedChainedSet<Parent, any> {}
}

declare class Config extends __Config.ChainedMap<void> {
  devServer: Config.DevServer;
  entryPoints: Config.TypedChainedMap<Config, Config.EntryPoint>;
  module: Config.Module;
  node: Config.ChainedMap<this>;
  output: Config.Output;
  optimization: Config.Optimization;
  performance: Config.Performance;
  plugins: Config.Plugins<this, webpack.Plugin>;
  resolve: Config.Resolve;
  resolveLoader: Config.ResolveLoader;

  amd(value: { [moduleName: string]: boolean }): this;
  bail(value: boolean): this;
  cache(value: boolean | any): this;
  devtool(value: Config.DevTool): this;
  context(value: string): this;
  externals(value: webpack.ExternalsElement | webpack.ExternalsElement[]): this;
  loader(value: any): this;
  name(value: string): this;
  mode(value: 'none' | 'development' | 'production'): this;
  parallelism(value: number): this;
  profile(value: boolean): this;
  recordsPath(value: string): this;
  recordsInputPath(value: string): this;
  recordsOutputPath(value: string): this;
  stats(value: webpack.Options.Stats): this;
  target(value: string): this;
  watch(value: boolean): this;
  watchOptions(value: webpack.Options.WatchOptions): this;

  entry(name: string): Config.EntryPoint;
  plugin(name: string): Config.Plugin<this, webpack.Plugin>;

  toConfig(): webpack.Configuration;
}

declare namespace Config {
  class Chained<Parent> extends __Config.Chained<Parent> {}
  class TypedChainedMap<Parent, Value> extends __Config.TypedChainedMap<
    Parent,
    Value
  > {}
  class ChainedMap<Parent> extends __Config.TypedChainedMap<Parent, any> {}
  class TypedChainedSet<Parent, Value> extends __Config.TypedChainedSet<
    Parent,
    Value
  > {}
  class ChainedSet<Parent> extends __Config.TypedChainedSet<Parent, any> {}

  class Plugins<
    Parent,
    PluginType extends Tapable.Plugin = webpack.Plugin
  > extends TypedChainedMap<Parent, Plugin<Parent, PluginType>> {}

  class Plugin<Parent, PluginType extends Tapable.Plugin = webpack.Plugin>
    extends ChainedMap<Parent>
    implements Orderable {
    init<P extends PluginType | PluginClass<PluginType>>(
      value: (
        plugin: P,
        args: P extends PluginClass ? ConstructorParameters<P> : any[],
      ) => PluginType,
    ): this;
    use<P extends string | PluginType | PluginClass<PluginType>>(
      plugin: P,
      args?: P extends PluginClass ? ConstructorParameters<P> : any[],
    ): this;
    tap<P extends PluginClass<PluginType>>(
      f: (args: ConstructorParameters<P>) => ConstructorParameters<P>,
    ): this;

    // Orderable
    before(name: string): this;
    after(name: string): this;
  }

  class Module extends ChainedMap<Config> {
    rules: TypedChainedMap<this, Rule>;
    rule(name: string): Rule;
    noParse(
      noParse: RegExp | RegExp[] | ((contentPath: string) => boolean),
    ): this;
    strictExportPresence(value: boolean): this;
  }

  class Output extends ChainedMap<Config> {
    auxiliaryComment(value: string | { [comment: string]: string }): this;
    chunkFilename(value: string): this;
    chunkLoadTimeout(value: number): this;
    crossOriginLoading(value: boolean | string): this;
    filename(value: string): this;
    library(value: string): this;
    libraryExport(value: string | string[]): this;
    libraryTarget(value: string): this;
    devtoolFallbackModuleFilenameTemplate(value: any): this;
    devtoolLineToLine(value: any): this;
    devtoolModuleFilenameTemplate(value: any): this;
    devtoolNamespace(value: string): this;
    globalObject(value: string): this;
    hashFunction(value: string): this;
    hashDigest(value: string): this;
    hashDigestLength(value: number): this;
    hashSalt(value: any): this;
    hotUpdateChunkFilename(value: string): this;
    hotUpdateFunction(value: any): this;
    hotUpdateMainFilename(value: string): this;
    jsonpFunction(value: string): this;
    path(value: string): this;
    pathinfo(value: boolean): this;
    publicPath(value: string): this;
    sourceMapFilename(value: string): this;
    sourcePrefix(value: string): this;
    strictModuleExceptionHandling(value: boolean): this;
    umdNamedDefine(value: boolean): this;
    futureEmitAssets(value: boolean): this;
  }

  class DevServer extends ChainedMap<Config> {
    allowedHosts: TypedChainedSet<this, string>;

    after(
      value: (app: any, server: any, compiler: webpack.Compiler) => void,
    ): this;
    before(
      value: (app: any, server: any, compiler: webpack.Compiler) => void,
    ): this;
    bonjour(value: boolean): this;
    clientLogLevel(value: 'none' | 'error' | 'warning' | 'info'): this;
    color(value: boolean): this;
    compress(value: boolean): this;
    contentBase(value: boolean | string | string[]): this;
    disableHostCheck(value: boolean): this;
    filename(value: string): this;
    headers(value: { [header: string]: string }): this;
    historyApiFallback(value: boolean | any): this;
    host(value: string): this;
    hot(value: boolean): this;
    hotOnly(value: boolean): this;
    http2(value: boolean): this;
    https(value: boolean | https.ServerOptions): this;
    index(value: string): this;
    info(value: boolean): this;
    inline(value: boolean): this;
    lazy(value: boolean): this;
    mimeTypes(value: Object): this;
    noInfo(value: boolean): this;
    open(value: boolean): this;
    openPage(value: string | string[]): this;
    overlay(value: boolean | { warnings?: boolean; errors?: boolean }): this;
    pfx(value: string): this;
    pfxPassphrase(value: string): this;
    port(value: number): this;
    progress(value: boolean): this;
    proxy(value: any): this;
    public(value: string): this;
    publicPath(publicPath: string): this;
    quiet(value: boolean): this;
    setup(value: (expressApp: any) => void): this;
    socket(value: string): this;
    sockHost(value: string): this;
    sockPath(value: string): this;
    sockPort(value: number): this;
    staticOptions(value: any): this;
    stats(value: webpack.Options.Stats): this;
    stdin(value: boolean): this;
    useLocalIp(value: boolean): this;
    watchContentBase(value: boolean): this;
    watchOptions(value: any): this;
    writeToDisk(value: boolean): this;
  }

  class Performance extends ChainedMap<Config> {
    hints(value: boolean | 'error' | 'warning'): this;
    maxEntrypointSize(value: number): this;
    maxAssetSize(value: number): this;
    assetFilter(value: (assetFilename: string) => boolean): this;
  }

  class EntryPoint extends TypedChainedSet<Config, string> {}

  class Resolve<T = Config> extends ChainedMap<T> {
    alias: TypedChainedMap<this, string>;
    aliasFields: TypedChainedSet<this, string>;
    descriptionFiles: TypedChainedSet<this, string>;
    extensions: TypedChainedSet<this, string>;
    mainFields: TypedChainedSet<this, string>;
    mainFiles: TypedChainedSet<this, string>;
    modules: TypedChainedSet<this, string>;
    plugins: TypedChainedMap<this, Plugin<this, webpack.ResolvePlugin>>;

    enforceExtension(value: boolean): this;
    enforceModuleExtension(value: boolean): this;
    unsafeCache(value: boolean | RegExp | RegExp[]): this;
    symlinks(value: boolean): this;
    cachePredicate(
      value: (data: { path: string; request: string }) => boolean,
    ): this;
    cacheWithContext(value: boolean): this;

    plugin(name: string): Plugin<this, webpack.ResolvePlugin>;
  }

  class ResolveLoader extends Resolve {
    moduleExtensions: ChainedSet<this>;
    packageMains: ChainedSet<this>;
  }

  class Rule<T = Module> extends ChainedMap<T> implements Orderable {
    rules: TypedChainedMap<this, Rule<Rule>>;
    oneOfs: TypedChainedMap<this, Rule<Rule>>;
    uses: TypedChainedMap<this, Use>;
    include: TypedChainedSet<this, webpack.Condition>;
    exclude: TypedChainedSet<this, webpack.Condition>;
    resolve: Resolve<Rule<T>>;

    parser(value: { [optName: string]: any }): this;
    test(value: webpack.Condition | webpack.Condition[]): this;
    type(
      value:
        | 'javascript/auto'
        | 'javascript/dynamic'
        | 'javascript/esm'
        | 'json'
        | 'webassembly/experimental',
    ): this;
    enforce(value: 'pre' | 'post'): this;

    use(name: string): Use<this>;
    rule(name: string): Rule<Rule>;
    oneOf(name: string): Rule<Rule>;
    pre(): this;
    post(): this;
    before(name: string): this;
    after(name: string): this;
    resourceQuery(value: webpack.Condition | webpack.Condition[]): this;
  }

  class Optimization extends ChainedMap<Config> {
    concatenateModules(value: boolean): this;
    flagIncludedChunks(value: boolean): this;
    mergeDuplicateChunks(value: boolean): this;
    minimize(value: boolean): this;
    minimizer(name: string): Config.Plugin<this, webpack.Plugin>;
    namedChunks(value: boolean): this;
    namedModules(value: boolean): this;
    nodeEnv(value: boolean | string): this;
    noEmitOnErrors(value: boolean): this;
    occurrenceOrder(value: boolean): this;
    portableRecords(value: boolean): this;
    providedExports(value: boolean): this;
    removeAvailableModules(value: boolean): this;
    removeEmptyChunks(value: boolean): this;
    runtimeChunk(value: boolean | 'single' | 'multiple' | RuntimeChunk): this;
    sideEffects(value: boolean): this;
    splitChunks(value: SplitChunksOptions): this;
    usedExports(value: boolean): this;
  }

  interface RuntimeChunk {
    name: string | RuntimeChunkFunction;
  }

  type RuntimeChunkFunction = (entryPoint: EntryPoint) => string;

  interface SplitChunksOptions {
    [name: string]: any;
  }

  interface LoaderOptions {
    [name: string]: any;
  }

  class Use<Parent = Rule> extends ChainedMap<Parent> implements Orderable {
    loader(value: string): this;
    options(value: LoaderOptions): this;

    tap(f: (options: LoaderOptions) => LoaderOptions): this;

    // Orderable
    before(name: string): this;
    after(name: string): this;
  }

  type DevTool =
    | 'eval'
    | 'inline-source-map'
    | 'cheap-eval-source-map'
    | 'cheap-source-map'
    | 'cheap-module-eval-source-map'
    | 'cheap-module-source-map'
    | 'eval-source-map'
    | 'source-map'
    | 'nosources-source-map'
    | 'hidden-source-map'
    | 'nosources-source-map'
    | '@eval'
    | '@inline-source-map'
    | '@cheap-eval-source-map'
    | '@cheap-source-map'
    | '@cheap-module-eval-source-map'
    | '@cheap-module-source-map'
    | '@eval-source-map'
    | '@source-map'
    | '@nosources-source-map'
    | '@hidden-source-map'
    | '@nosources-source-map'
    | '#eval'
    | '#inline-source-map'
    | '#cheap-eval-source-map'
    | '#cheap-source-map'
    | '#cheap-module-eval-source-map'
    | '#cheap-module-source-map'
    | '#eval-source-map'
    | '#source-map'
    | '#nosources-source-map'
    | '#hidden-source-map'
    | '#nosources-source-map'
    | '#@eval'
    | '#@inline-source-map'
    | '#@cheap-eval-source-map'
    | '#@cheap-source-map'
    | '#@cheap-module-eval-source-map'
    | '#@cheap-module-source-map'
    | '#@eval-source-map'
    | '#@source-map'
    | '#@nosources-source-map'
    | '#@hidden-source-map'
    | '#@nosources-source-map'
    | boolean;

  interface PluginClass<PluginType extends Tapable.Plugin = webpack.Plugin> {
    new (...opts: any[]): PluginType;
  }

  interface Orderable {
    before(name: string): this;
    after(name: string): this;
  }
}
