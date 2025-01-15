# webpack-chain

[![NPM version][npm-image]][npm-url]
[![NPM downloads][npm-downloads]][npm-url]
[![Build Status][travis-image]][travis-url]

Use a chaining API to generate and simplify the modification of
webpack version 2-4 configurations.

This documentation corresponds to v6 of webpack-chain. For previous versions, see:

* [v5 docs](https://github.com/neutrinojs/webpack-chain/tree/v5)
* [v4 docs](https://github.com/neutrinojs/webpack-chain/tree/v4)
* [v3 docs](https://github.com/neutrinojs/webpack-chain/tree/v3)
* [v2 docs](https://github.com/neutrinojs/webpack-chain/tree/v2)
* [v1 docs](https://github.com/neutrinojs/webpack-chain/tree/v1)

_Note: while webpack-chain is utilized extensively in Neutrino, this package is
completely standalone and can be used by any project._

**[Chinese docs(中文文档)](https://github.com/Yatoo2018/webpack-chain/tree/zh-cmn-Hans)**

## Introduction

webpack's core configuration is based on creating and modifying a
potentially unwieldy JavaScript object. While this is OK for configurations
on individual projects, trying to share these objects across projects and
make subsequent modifications gets messy, as you need to have a deep
understanding of the underlying object structure to make those changes.

`webpack-chain` attempts to improve this process by providing a chainable or
fluent API for creating and modifying webpack configurations. Key portions
of the API can be referenced by user-specified names, which helps to
standardize how to modify a configuration across projects.

This is easier explained through the examples following.

## Installation

`webpack-chain` requires Node.js v6.9 and higher. `webpack-chain` also
only creates configuration objects designed for use in webpack versions 2, 3,
and 4.

You may install this package using either Yarn or npm (choose one):

**Yarn**

```bash
yarn add --dev webpack-chain
```

**npm**

```bash
npm install --save-dev webpack-chain
```

## Getting Started

Once you have `webpack-chain` installed, you can start creating a
webpack configuration. For this guide, our example base configuration will
be `webpack.config.js` in the root of our project directory.

```js
// Require the webpack-chain module. This module exports a single
// constructor function for creating a configuration API.
const Config = require('webpack-chain');

// Instantiate the configuration with a new API
const config = new Config();

// Make configuration changes using the chain API.
// Every API call tracks a change to the stored configuration.

config
  // Interact with entry points
  .entry('index')
    .add('src/index.js')
    .end()
  // Modify output settings
  .output
    .path('dist')
    .filename('[name].bundle.js');

// Create named rules which can be modified later
config.module
  .rule('lint')
    .test(/\.js$/)
    .pre()
    .include
      .add('src')
      .end()
    // Even create named uses (loaders)
    .use('eslint')
      .loader('eslint-loader')
      .options({
        rules: {
          semi: 'off'
        }
      });

config.module
  .rule('compile')
    .test(/\.js$/)
    .include
      .add('src')
      .add('test')
      .end()
    .use('babel')
      .loader('babel-loader')
      .options({
        presets: [
          ['@babel/preset-env', { modules: false }]
        ]
      });

// Create named plugins too!
config
  .plugin('clean')
    .use(CleanPlugin, [['dist'], { root: '/dir' }]);

// Export the completed configuration object to be consumed by webpack
module.exports = config.toConfig();
```

Having shared configurations is also simple. Just export the configuration
and call `.toConfig()` prior to passing to webpack.

```js
// webpack.core.js
const Config = require('webpack-chain');
const config = new Config();

// Make configuration shared across targets
// ...

module.exports = config;

// webpack.dev.js
const config = require('./webpack.core');

// Dev-specific configuration
// ...
module.exports = config.toConfig();

// webpack.prod.js
const config = require('./webpack.core');

// Production-specific configuration
// ...
module.exports = config.toConfig();
```

## ChainedMap

One of the core API interfaces in webpack-chain is a `ChainedMap`. A
`ChainedMap` operates similar to a JavaScript Map, with some conveniences for
chaining and generating configuration. If a property is marked as being a
`ChainedMap`, it will have an API and methods as described below:

**Unless stated otherwise, these methods will return the `ChainedMap`, allowing
you to chain these methods.**

```js
// Remove all entries from a Map.
clear()
```

```js
// Remove a single entry from a Map given its key.
// key: *
delete(key)
```

```js
// Fetch the value from a Map located at the corresponding key.
// key: *
// returns: value
get(key)
```

```js
// Fetch the value from a Map located at the corresponding key.
// If the key is missing, the key is set to the result of function fn.
// key: *
// fn: Function () -> value
// returns: value
getOrCompute(key, fn)
```

```js
// Set a value on the Map stored at the `key` location.
// key: *
// value: *
set(key, value)
```

```js
// Returns `true` or `false` based on whether a Map as has a value set at a
// particular key.
// key: *
// returns: Boolean
has(key)
```

```js
// Returns an array of all the values stored in the Map.
// returns: Array
values()
```

```js
// Returns an object of all the entries in the backing Map
// where the key is the object property, and the value
// corresponding to the key. Will return `undefined` if the backing
// Map is empty.
// This will order properties by their name if the value is
// a ChainedMap that used .before() or .after().
// returns: Object, undefined if empty
entries()
```

```js
// Provide an object which maps its properties and values
// into the backing Map as keys and values.
// You can also provide an array as the second argument
// for property names to omit from being merged.
// obj: Object
// omit: Optional Array
merge(obj, omit)
```

```js
// Execute a function against the current configuration context
// handler: Function -> ChainedMap
  // A function which is given a single argument of the ChainedMap instance
batch(handler)
```

```js
// Conditionally execute a function to continue configuration
// condition: Boolean
// whenTruthy: Function -> ChainedMap
  // invoked when condition is truthy, given a single argument of the ChainedMap instance
// whenFalsy: Optional Function -> ChainedMap
  // invoked when condition is falsy, given a single argument of the ChainedMap instance
when(condition, whenTruthy, whenFalsy)
```

## ChainedSet

Another of the core API interfaces in webpack-chain is a `ChainedSet`. A
`ChainedSet` operates similar to a JavaScript Set, with some conveniences for
chaining and generating configuration. If a property is marked as being a
`ChainedSet`, it will have an API and methods as described below:

**Unless stated otherwise, these methods will return the `ChainedSet`, allowing
you to chain these methods.**

```js
// Add/append a value to the end of a Set.
// value: *
add(value)
```

```js
// Add a value to the beginning of a Set.
// value: *
prepend(value)
```

```js
// Remove all values from a Set.
clear()
```

```js
// Remove a specific value from a Set.
// value: *
delete(value)
```

```js
// Returns `true` or `false` based on whether or not the
// backing Set contains the specified value.
// value: *
// returns: Boolean
has(value)
```

```js
// Returns an array of values contained in the backing Set.
// returns: Array
values()
```

```js
// Concatenates the given array to the end of the backing Set.
// arr: Array
merge(arr)
```

```js
// Execute a function against the current configuration context
// handler: Function -> ChainedSet
  // A function which is given a single argument of the ChainedSet instance
batch(handler)
```

```js
// Conditionally execute a function to continue configuration
// condition: Boolean
// whenTruthy: Function -> ChainedSet
  // invoked when condition is truthy, given a single argument of the ChainedSet instance
// whenFalsy: Optional Function -> ChainedSet
  // invoked when condition is falsy, given a single argument of the ChainedSet instance
when(condition, whenTruthy, whenFalsy)
```

## Shorthand methods

A number of shorthand methods exist for setting a value on a `ChainedMap`
with the same key as the shorthand method name.
For example, `devServer.hot` is a shorthand method, so it can be used as:

```js
// A shorthand method for setting a value on a ChainedMap
devServer.hot(true);

// This would be equivalent to:
devServer.set('hot', true);
```

A shorthand method is chainable, so calling it will return the original
instance, allowing you to continue to chain.

### Config

Create a new configuration object.

```js
const Config = require('webpack-chain');

const config = new Config();
```

Moving to deeper points in the API will change the context of what you
are modifying. You can move back to the higher context by either referencing
the top-level `config` again, or by calling `.end()` to move up one level.
If you are familiar with jQuery, `.end()` works similarly. All API calls
will return the API instance at the current context unless otherwise
specified. This is so you may chain API calls continuously if desired.

For details on the specific values that are valid for all shorthand and
low-level methods, please refer to their corresponding name in the
[webpack docs hierarchy](https://webpack.js.org/configuration/).

```js
Config : ChainedMap
```

#### Config shorthand methods

```js
config
  .amd(amd)
  .bail(bail)
  .cache(cache)
  .devtool(devtool)
  .context(context)
  .externals(externals)
  .loader(loader)
  .name(name)
  .mode(mode)
  .parallelism(parallelism)
  .profile(profile)
  .recordsPath(recordsPath)
  .recordsInputPath(recordsInputPath)
  .recordsOutputPath(recordsOutputPath)
  .stats(stats)
  .target(target)
  .watch(watch)
  .watchOptions(watchOptions)
```

#### Config entryPoints

```js
// Backed at config.entryPoints : ChainedMap
config.entry(name) : ChainedSet

config
  .entry(name)
    .add(value)
    .add(value)

config
  .entry(name)
    .clear()

// Using low-level config.entryPoints:

config.entryPoints
  .get(name)
    .add(value)
    .add(value)

config.entryPoints
  .get(name)
    .clear()
```

#### Config output: shorthand methods

```js
config.output : ChainedMap

config.output
  .auxiliaryComment(auxiliaryComment)
  .chunkFilename(chunkFilename)
  .chunkLoadTimeout(chunkLoadTimeout)
  .crossOriginLoading(crossOriginLoading)
  .devtoolFallbackModuleFilenameTemplate(devtoolFallbackModuleFilenameTemplate)
  .devtoolLineToLine(devtoolLineToLine)
  .devtoolModuleFilenameTemplate(devtoolModuleFilenameTemplate)
  .devtoolNamespace(devtoolNamespace)
  .filename(filename)
  .hashFunction(hashFunction)
  .hashDigest(hashDigest)
  .hashDigestLength(hashDigestLength)
  .hashSalt(hashSalt)
  .hotUpdateChunkFilename(hotUpdateChunkFilename)
  .hotUpdateFunction(hotUpdateFunction)
  .hotUpdateMainFilename(hotUpdateMainFilename)
  .jsonpFunction(jsonpFunction)
  .library(library)
  .libraryExport(libraryExport)
  .libraryTarget(libraryTarget)
  .path(path)
  .pathinfo(pathinfo)
  .publicPath(publicPath)
  .sourceMapFilename(sourceMapFilename)
  .sourcePrefix(sourcePrefix)
  .strictModuleExceptionHandling(strictModuleExceptionHandling)
  .umdNamedDefine(umdNamedDefine)
```

#### Config resolve: shorthand methods

```js
config.resolve : ChainedMap

config.resolve
  .cachePredicate(cachePredicate)
  .cacheWithContext(cacheWithContext)
  .enforceExtension(enforceExtension)
  .enforceModuleExtension(enforceModuleExtension)
  .unsafeCache(unsafeCache)
  .symlinks(symlinks)
```

#### Config resolve alias

```js
config.resolve.alias : ChainedMap

config.resolve.alias
  .set(key, value)
  .set(key, value)
  .delete(key)
  .clear()
```

#### Config resolve modules

```js
config.resolve.modules : ChainedSet

config.resolve.modules
  .add(value)
  .prepend(value)
  .clear()
```

#### Config resolve aliasFields

```js
config.resolve.aliasFields : ChainedSet

config.resolve.aliasFields
  .add(value)
  .prepend(value)
  .clear()
```

#### Config resolve descriptionFields

```js
config.resolve.descriptionFields : ChainedSet

config.resolve.descriptionFields
  .add(value)
  .prepend(value)
  .clear()
```

#### Config resolve extensions

```js
config.resolve.extensions : ChainedSet

config.resolve.extensions
  .add(value)
  .prepend(value)
  .clear()
```

#### Config resolve mainFields

```js
config.resolve.mainFields : ChainedSet

config.resolve.mainFields
  .add(value)
  .prepend(value)
  .clear()
```

#### Config resolve mainFiles

```js
config.resolve.mainFiles : ChainedSet

config.resolve.mainFiles
  .add(value)
  .prepend(value)
  .clear()
```

#### Config resolveLoader

The API for `config.resolveLoader` is identical to `config.resolve` with
the following additions:

#### Config resolveLoader moduleExtensions

```js
config.resolveLoader.moduleExtensions : ChainedSet

config.resolveLoader.moduleExtensions
  .add(value)
  .prepend(value)
  .clear()
```

#### Config resolveLoader packageMains

```js
config.resolveLoader.packageMains : ChainedSet

config.resolveLoader.packageMains
  .add(value)
  .prepend(value)
  .clear()
```

#### Config performance: shorthand methods

```js
config.performance : ChainedMap

config.performance
  .hints(hints)
  .maxEntrypointSize(maxEntrypointSize)
  .maxAssetSize(maxAssetSize)
  .assetFilter(assetFilter)
```

#### Configuring optimizations: shorthand methods

```js
config.optimization : ChainedMap

config.optimization
  .concatenateModules(concatenateModules)
  .flagIncludedChunks(flagIncludedChunks)
  .mergeDuplicateChunks(mergeDuplicateChunks)
  .minimize(minimize)
  .namedChunks(namedChunks)
  .namedModules(namedModules)
  .nodeEnv(nodeEnv)
  .noEmitOnErrors(noEmitOnErrors)
  .occurrenceOrder(occurrenceOrder)
  .portableRecords(portableRecords)
  .providedExports(providedExports)
  .removeAvailableModules(removeAvailableModules)
  .removeEmptyChunks(removeEmptyChunks)
  .runtimeChunk(runtimeChunk)
  .sideEffects(sideEffects)
  .splitChunks(splitChunks)
  .usedExports(usedExports)
```

#### Config optimization minimizers

```js
// Backed at config.optimization.minimizers
config.optimization
  .minimizer(name) : ChainedMap
```

#### Config optimization minimizers: adding

_NOTE: Do not use `new` to create the minimizer plugin, as this will be done for you._

```js
config.optimization
  .minimizer(name)
  .use(WebpackPlugin, args)

// Examples

config.optimization
  .minimizer('css')
  .use(OptimizeCSSAssetsPlugin, [{ cssProcessorOptions: { safe: true } }])

// Minimizer plugins can also be specified by their path, allowing the expensive require()s to be
// skipped in cases where the plugin or webpack configuration won't end up being used.
config.optimization
  .minimizer('css')
  .use(require.resolve('optimize-css-assets-webpack-plugin'), [{ cssProcessorOptions: { safe: true } }])

```

#### Config optimization minimizers: modify arguments

```js
config.optimization
  .minimizer(name)
  .tap(args => newArgs)

// Example
config.optimization
  .minimizer('css')
  .tap(args => [...args, { cssProcessorOptions: { safe: false } }])
```

#### Config optimization minimizers: modify instantiation

```js
config.optimization
  .minimizer(name)
  .init((Plugin, args) => new Plugin(...args));
```

#### Config optimization minimizers: removing

```js
config.optimization.minimizers.delete(name)
```

#### Config plugins

```js
// Backed at config.plugins
config.plugin(name) : ChainedMap
```

#### Config plugins: adding

_NOTE: Do not use `new` to create the plugin, as this will be done for you._

```js
config
  .plugin(name)
  .use(WebpackPlugin, args)

// Examples

config
  .plugin('hot')
  .use(webpack.HotModuleReplacementPlugin);

// Plugins can also be specified by their path, allowing the expensive require()s to be
// skipped in cases where the plugin or webpack configuration won't end up being used.
config
  .plugin('env')
  .use(require.resolve('webpack/lib/EnvironmentPlugin'), [{ 'VAR': false }]);
```

#### Config plugins: modify arguments

```js
config
  .plugin(name)
  .tap(args => newArgs)

// Example
config
  .plugin('env')
  .tap(args => [...args, 'SECRET_KEY']);
```

#### Config plugins: modify instantiation

```js
config
  .plugin(name)
  .init((Plugin, args) => new Plugin(...args));
```

#### Config plugins: removing

```js
config.plugins.delete(name)
```

#### Config plugins: ordering before

Specify that the current `plugin` context should operate before another named
`plugin`. You cannot use both `.before()` and `.after()` on the same plugin.

```js
config
  .plugin(name)
    .before(otherName)

// Example

config
  .plugin('html-template')
    .use(HtmlWebpackTemplate)
    .end()
  .plugin('script-ext')
    .use(ScriptExtWebpackPlugin)
    .before('html-template');
```

#### Config plugins: ordering after

Specify that the current `plugin` context should operate after another named
`plugin`. You cannot use both `.before()` and `.after()` on the same plugin.

```js
config
  .plugin(name)
    .after(otherName)

// Example

config
  .plugin('html-template')
    .after('script-ext')
    .use(HtmlWebpackTemplate)
    .end()
  .plugin('script-ext')
    .use(ScriptExtWebpackPlugin);
```

#### Config resolve plugins

```js
// Backed at config.resolve.plugins
config.resolve.plugin(name) : ChainedMap
```

#### Config resolve plugins: adding

_NOTE: Do not use `new` to create the plugin, as this will be done for you._

```js
config.resolve
  .plugin(name)
  .use(WebpackPlugin, args)
```

#### Config resolve plugins: modify arguments

```js
config.resolve
  .plugin(name)
  .tap(args => newArgs)
```

#### Config resolve plugins: modify instantiation

```js
config.resolve
  .plugin(name)
  .init((Plugin, args) => new Plugin(...args))
```

#### Config resolve plugins: removing

```js
config.resolve.plugins.delete(name)
```

#### Config resolve plugins: ordering before

Specify that the current `plugin` context should operate before another named
`plugin`. You cannot use both `.before()` and `.after()` on the same resolve
plugin.

```js
config.resolve
  .plugin(name)
    .before(otherName)

// Example

config.resolve
  .plugin('beta')
    .use(BetaWebpackPlugin)
    .end()
  .plugin('alpha')
    .use(AlphaWebpackPlugin)
    .before('beta');
```

#### Config resolve plugins: ordering after

Specify that the current `plugin` context should operate after another named
`plugin`. You cannot use both `.before()` and `.after()` on the same resolve
plugin.

```js
config.resolve
  .plugin(name)
    .after(otherName)

// Example

config.resolve
  .plugin('beta')
    .after('alpha')
    .use(BetaWebpackTemplate)
    .end()
  .plugin('alpha')
    .use(AlphaWebpackPlugin);
```

#### Config node

```js
config.node : ChainedMap

config.node
  .set('__dirname', 'mock')
  .set('__filename', 'mock');
```

#### Config devServer

```js
config.devServer : ChainedMap
```

#### Config devServer allowedHosts

```js
config.devServer.allowedHosts : ChainedSet

config.devServer.allowedHosts
  .add(value)
  .prepend(value)
  .clear()
```

#### Config devServer: shorthand methods

```js
config.devServer
  .after(after)
  .before(before)
  .bonjour(bonjour)
  .clientLogLevel(clientLogLevel)
  .color(color)
  .compress(compress)
  .contentBase(contentBase)
  .disableHostCheck(disableHostCheck)
  .filename(filename)
  .headers(headers)
  .historyApiFallback(historyApiFallback)
  .host(host)
  .hot(hot)
  .hotOnly(hotOnly)
  .http2(http2)
  .https(https)
  .index(index)
  .info(info)
  .inline(inline)
  .lazy(lazy)
  .mimeTypes(mimeTypes)
  .noInfo(noInfo)
  .open(open)
  .openPage(openPage)
  .overlay(overlay)
  .pfx(pfx)
  .pfxPassphrase(pfxPassphrase)
  .port(port)
  .progress(progress)
  .proxy(proxy)
  .public(public)
  .publicPath(publicPath)
  .quiet(quiet)
  .setup(setup)
  .socket(socket)
  .sockHost(sockHost)
  .sockPath(sockPath)
  .sockPort(sockPort)
  .staticOptions(staticOptions)
  .stats(stats)
  .stdin(stdin)
  .useLocalIp(useLocalIp)
  .watchContentBase(watchContentBase)
  .watchOptions(watchOptions)
  .writeToDisk(writeToDisk)
```

#### Config module

```js
config.module : ChainedMap
```

#### Config module: shorthand methods

```js
config.module : ChainedMap

config.module
  .noParse(noParse)
```

#### Config module rules: shorthand methods

```js
config.module.rules : ChainedMap

config.module
  .rule(name)
    .test(test)
    .pre()
    .post()
    .enforce(preOrPost)
```

#### Config module rules uses (loaders): creating

```js
config.module.rules{}.uses : ChainedMap

config.module
  .rule(name)
    .use(name)
      .loader(loader)
      .options(options)

// Example

config.module
  .rule('compile')
    .use('babel')
      .loader('babel-loader')
      .options({ presets: ['@babel/preset-env'] });
```

#### Config module rules uses (loaders): modifying options

```js
config.module
  .rule(name)
    .use(name)
      .tap(options => newOptions)

// Example

config.module
  .rule('compile')
    .use('babel')
      .tap(options => merge(options, {
        plugins: ['@babel/plugin-proposal-class-properties']
      }));
```

#### Config module rules nested rules:

```js
config.module.rules{}.rules : ChainedMap<Rule>

config.module
  .rule(name)
    .rule(name)

// Example

config.module
  .rule('css')
    .test(/\.css$/)
    .use('style')
      .loader('style-loader')
      .end()
    .rule('postcss')
      .resourceQuery(/postcss/)
      .use('postcss')
        .loader('postcss-loader')
```

#### Config module rules nested rules: ordering before
Specify that the current `rule` context should operate before another named
`rule`. You cannot use both `.before()` and `.after()` on the same `rule`.

```js
config.module.rules{}.rules : ChainedMap<Rule>

config.module
  .rule(name)
    .rule(name)
      .before(otherName)

// Example

config.module
  .rule('css')
    .use('style')
      .loader('style-loader')
      .end()
    .rule('postcss')
      .resourceQuery(/postcss/)
      .use('postcss')
        .loader('postcss-loader')
        .end()
      .end()
    .rule('css-loader')
      .resourceQuery(/css-loader/)
      .before('postcss')
      .use('css-loader')
        .loader('css-loader')
```

#### Config module rules nested rules: ordering after
Specify that the current `rule` context should operate after another named
`rule`. You cannot use both `.before()` and `.after()` on the same `rule`.

```js
config.module.rules{}.rules : ChainedMap<Rule>

config.module
  .rule(name)
    .rule(name)
      .after(otherName)

// Example

config.module
  .rule('css')
    .use('style')
      .loader('style-loader')
      .end()
    .rule('postcss')
      .resourceQuery(/postcss/)
      .after('css-loader')
      .use('postcss')
        .loader('postcss-loader')
        .end()
      .end()
    .rule('css-loader')
      .resourceQuery(/css-loader/)
      .use('css-loader')
        .loader('css-loader')
```

#### Config module rules oneOfs (conditional rules):

```js
config.module.rules{}.oneOfs : ChainedMap<Rule>

config.module
  .rule(name)
    .oneOf(name)

// Example

config.module
  .rule('css')
    .oneOf('inline')
      .resourceQuery(/inline/)
      .use('url')
        .loader('url-loader')
        .end()
      .end()
    .oneOf('external')
      .resourceQuery(/external/)
      .use('file')
        .loader('file-loader')
```

#### Config module rules oneOfs (conditional rules): ordering before
Specify that the current `oneOf` context should operate before another named
`oneOf`. You cannot use both `.before()` and `.after()` on the same `oneOf`.

```js
config.module
  .rule(name)
    .oneOf(name)
      .before()

// Example

config.module
  .rule('scss')
    .test(/\.scss$/)
    .oneOf('normal')
      .use('sass')
        .loader('sass-loader')
        .end()
      .end()
    .oneOf('sass-vars')
      .before('normal')
      .resourceQuery(/\?sassvars/)
      .use('sass-vars')
        .loader('sass-vars-to-js-loader')
```

#### Config module rules oneOfs (conditional rules): ordering after
Specify that the current `oneOf` context should operate after another named
`oneOf`. You cannot use both `.before()` and `.after()` on the same `oneOf`.

```js
config.module
  .rule(name)
    .oneOf(name)
      .after()

// Example

config.module
  .rule('scss')
    .test(/\.scss$/)
    .oneOf('vue')
      .resourceQuery(/\?vue/)
      .use('vue-style')
        .loader('vue-style-loader')
        .end()
      .end()
    .oneOf('normal')
      .use('sass')
        .loader('sass-loader')
        .end()
      .end()
    .oneOf('sass-vars')
      .after('vue')
      .resourceQuery(/\?sassvars/)
      .use('sass-vars')
        .loader('sass-vars-to-js-loader')
```

#### Config module rules resolve

Specify a resolve configuration to be merged over the default `config.resolve`
for modules that match the rule.

See "Config resolve" sections above for full syntax.

**Note:** This option is supported by webpack since 4.36.1.

```js
config.module
  .rule(name)
    .resolve

// Example

config.module
  .rule('scss')
    .test(/\.scss$/)
    .resolve
      .symlinks(true)
```

---

### Merging Config

webpack-chain supports merging in an object to the configuration instance which
matches a layout similar to how the webpack-chain schema is laid out.

**Note:** This object does not match the webpack configuration schema exactly
(for example the `[name]` keys for entry/rules/plugins), so you may need to transform
webpack configuration objects (such as those output by webpack-chain's `.toConfig()`)
to match the layout below prior to passing to `.merge()`.

```js
config.merge({ devtool: 'source-map' });

config.get('devtool') // "source-map"
```

```js
config.merge({
  [key]: value,

  amd,
  bail,
  cache,
  context,
  devtool,
  externals,
  loader,
  mode,
  parallelism,
  profile,
  recordsPath,
  recordsInputPath,
  recordsOutputPath,
  stats,
  target,
  watch,
  watchOptions,

  entry: {
    [name]: [...values]
  },

  plugin: {
    [name]: {
      plugin: WebpackPlugin,
      args: [...args],
      before,
      after
    }
  },

  devServer: {
    [key]: value,

    clientLogLevel,
    compress,
    contentBase,
    filename,
    headers,
    historyApiFallback,
    host,
    hot,
    hotOnly,
    https,
    inline,
    lazy,
    noInfo,
    overlay,
    port,
    proxy,
    quiet,
    setup,
    stats,
    watchContentBase
  },

  node: {
    [key]: value
  },

  optimization: {
    concatenateModules,
    flagIncludedChunks,
    mergeDuplicateChunks,
    minimize,
    minimizer: {
      [name]: {
        plugin: WebpackPlugin,
        args: [...args],
        before,
        after
      }
    },
    namedChunks,
    namedModules,
    nodeEnv,
    noEmitOnErrors,
    occurrenceOrder,
    portableRecords,
    providedExports,
    removeAvailableModules,
    removeEmptyChunks,
    runtimeChunk,
    sideEffects,
    splitChunks,
    usedExports,
  },

  performance: {
    [key]: value,

    hints,
    maxEntrypointSize,
    maxAssetSize,
    assetFilter
  },

  resolve: {
    [key]: value,

    alias: {
      [key]: value
    },
    aliasFields: [...values],
    descriptionFields: [...values],
    extensions: [...values],
    mainFields: [...values],
    mainFiles: [...values],
    modules: [...values],

    plugin: {
      [name]: {
        plugin: WebpackPlugin,
        args: [...args],
        before,
        after
      }
    }
  },

  resolveLoader: {
    [key]: value,

    alias: {
      [key]: value
    },
    aliasFields: [...values],
    descriptionFields: [...values],
    extensions: [...values],
    mainFields: [...values],
    mainFiles: [...values],
    modules: [...values],
    moduleExtensions: [...values],
    packageMains: [...values],

    plugin: {
      [name]: {
        plugin: WebpackPlugin,
        args: [...args],
        before,
        after
      }
    }
  },

  module: {
    [key]: value,

    rule: {
      [name]: {
        [key]: value,

        enforce,
        issuer,
        parser,
        resource,
        resourceQuery,
        test,

        include: [...paths],
        exclude: [...paths],

        rules: {
          [name]: Rule
        },

        oneOf: {
          [name]: Rule
        },

        use: {
          [name]: {
            loader: LoaderString,
            options: LoaderOptions,
            before,
            after
          }
        }
      }
    }
  }
})
```

### Conditional configuration

When working with instances of `ChainedMap` and `ChainedSet`, you can perform
conditional configuration using `when`. You must specify an expression to
`when()` which will be evaluated for truthiness or falsiness. If the expression
is truthy, the first function argument will be invoked with an instance of the
current chained instance. You can optionally provide a second function to be
invoked when the condition is falsy, which is also given the current chained
instance.

```js
// Example: Only add minify plugin during production
config
  .when(process.env.NODE_ENV === 'production', config => {
    config
      .plugin('minify')
      .use(BabiliWebpackPlugin);
  });
```

```js
// Example: Only add minify plugin during production,
// otherwise set devtool to source-map
config
  .when(process.env.NODE_ENV === 'production',
    config => config.plugin('minify').use(BabiliWebpackPlugin),
    config => config.devtool('source-map')
  );
```

### Inspecting generated configuration

You can inspect the generated webpack config using `config.toString()`. This
will generate a stringified version of the config with comment hints for named
rules, uses and plugins:

```js
config
  .module
    .rule('compile')
      .test(/\.js$/)
      .use('babel')
        .loader('babel-loader');

config.toString();

/*
{
  module: {
    rules: [
      /* config.module.rule('compile') */
      {
        test: /\.js$/,
        use: [
          /* config.module.rule('compile').use('babel') */
          {
            loader: 'babel-loader'
          }
        ]
      }
    ]
  }
}
*/
```

By default the generated string cannot be used directly as real webpack config
if it contains objects and plugins that need to be required. In order to
generate usable config, you can customize how objects and plugins are
stringified by setting a special `__expression` property on them:

```js
const sass = require('sass');
sass.__expression = `require('sass')`;

class MyPlugin {}
MyPlugin.__expression = `require('my-plugin')`;

function myFunction () {}
myFunction.__expression = `require('my-function')`;

config
  .plugin('example')
    .use(MyPlugin, [{ fn: myFunction, implementation: sass, }]);

config.toString();

/*
{
  plugins: [
    new (require('my-plugin'))({
      fn: require('my-function'),
      implementation: require('sass')
    })
  ]
}
*/
```

Plugins specified via their path will have their `require()` statement generated
automatically:

```js
config
  .plugin('env')
    .use(require.resolve('webpack/lib/ProvidePlugin'), [{ jQuery: 'jquery' }])

config.toString();

/*
{
  plugins: [
    new (require('/foo/bar/src/node_modules/webpack/lib/EnvironmentPlugin.js'))(
      {
        jQuery: 'jquery'
      }
    )
  ]
}
*/
```

You can also call `toString` as a static method on `Config` in order to
modify the configuration object prior to stringifying.

```js
Config.toString({
  ...config.toConfig(),
  module: {
    defaultRules: [
      {
        use: [
          {
            loader: 'banner-loader',
            options: { prefix: 'banner-prefix.txt' },
          },
        ],
      },
    ],
  },
})
```

```
{
  plugins: [
    /* config.plugin('foo') */
    new TestPlugin()
  ],
  module: {
    defaultRules: [
      {
        use: [
          {
            loader: 'banner-loader',
            options: {
              prefix: 'banner-prefix.txt'
            }
          }
        ]
      }
    ]
  }
}
```

[npm-image]: https://img.shields.io/npm/v/webpack-chain.svg
[npm-downloads]: https://img.shields.io/npm/dt/webpack-chain.svg
[npm-url]: https://www.npmjs.com/package/webpack-chain
[travis-image]: https://api.travis-ci.com/neutrinojs/webpack-chain.svg?branch=master
[travis-url]: https://travis-ci.com/neutrinojs/webpack-chain
