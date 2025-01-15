[![npm][npm]][npm-url]
[![node][node]][node-url]
![npm](https://img.shields.io/npm/dw/html-webpack-plugin.svg)
[![tests][tests]][tests-url]
[![Backers on Open Collective](https://opencollective.com/html-webpack-plugin/backers/badge.svg)](#backers)
 [![Sponsors on Open Collective](https://opencollective.com/html-webpack-plugin/sponsors/badge.svg)](#sponsors) 

<div align="center">
  <img width="200" height="200" src="https://www.w3.org/html/logo/downloads/HTML5_Badge.svg">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200"
      src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
  <div>
    <img width="100" height="100" title="Webpack Plugin" src="http://michael-ciniawsky.github.io/postcss-load-plugins/logo.svg">
  </div>
  <h1>HTML Webpack Plugin</h1>
  <p>Plugin that simplifies creation of HTML files to serve your bundles</p>
</div>

<h2 align="center">Install</h2>

<h3>Webpack 5</h3>

```bash
  npm i --save-dev html-webpack-plugin
```

```bash
  yarn add --dev html-webpack-plugin
```


<h3>Webpack 4</h3>

```bash
  npm i --save-dev html-webpack-plugin@4
```

```bash
  yarn add --dev html-webpack-plugin@4
```


This is a [webpack](http://webpack.js.org/) plugin that simplifies creation of HTML files to serve your `webpack` bundles. This is especially useful for `webpack` bundles that include a hash in the filename which changes every compilation. You can either let the plugin generate an HTML file for you, supply
your own template using `lodash` templates or use your own loader.

<h2 align="center">Sponsors</h2>

<a href="https://opencollective.com/html-webpack-plugin/sponsor/0/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/1/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/2/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/3/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/4/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/5/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/6/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/7/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/8/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/html-webpack-plugin/sponsor/9/website" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/sponsor/9/avatar.svg"></a>

Thanks for supporting the ongoing improvements to the html-webpack-plugin!  

<h2 align="center">Zero Config</h2>

The `html-webpack-plugin` works without configuration.  
It's a great addition to the [⚙️ webpack-config-plugins](https://github.com/namics/webpack-config-plugins/blob/master/README.md#zero-config-webpack-dev-server-example).

<h2 align="center">Plugins</h2>

The `html-webpack-plugin` provides [hooks](https://github.com/jantimon/html-webpack-plugin#events) to extend it to your needs. There are already some really powerful plugins which can be integrated with zero configuration

 * [webpack-subresource-integrity](https://www.npmjs.com/package/webpack-subresource-integrity) for enhanced asset security
 * [appcache-webpack-plugin](https://github.com/lettertwo/appcache-webpack-plugin) for iOS and Android offline usage
 * [favicons-webpack-plugin](https://github.com/jantimon/favicons-webpack-plugin) which generates favicons and icons for iOS, Android and desktop browsers
 * [html-webpack-harddisk-plugin](https://github.com/jantimon/html-webpack-harddisk-plugin) can be used to always write to disk the html file, useful when webpack-dev-server / HMR are being used 
 * [html-webpack-inline-svg-plugin](https://github.com/thegc/html-webpack-inline-svg-plugin) to inline SVGs in the resulting HTML file.
 * [html-webpack-exclude-assets-plugin](https://github.com/jamesjieye/html-webpack-exclude-assets-plugin) for excluding assets using regular expressions
 * [html-webpack-include-assets-plugin](https://github.com/jharris4/html-webpack-include-assets-plugin) for including lists of js or css file paths (such as those copied by the copy-webpack-plugin).
 * [html-webpack-injector](https://github.com/thearchitgarg/html-webpack-injector) to inject chunks in `head` or `body` (different locations ) of same html document.
 * [resource-hints-webpack-plugin](https://github.com/jantimon/resource-hints-webpack-plugin) to add resource hints for faster initial page loads using `<link rel='preload'>` and `<link rel='prefetch'>`
 * [link-media-html-webpack-plugin](https://github.com/yaycmyk/link-media-html-webpack-plugin) allows for injected stylesheet `<link />` tags to have their media attribute set automatically; useful for providing specific desktop/mobile/print etc. stylesheets that the browser will conditionally download
 * [html-webpack-inline-style-plugin](https://github.com/djaax/html-webpack-inline-style-plugin) for inlining styles to HTML elements using [juice](https://github.com/Automattic/juice). Useful for email generation automatisation.
 * [html-webpack-exclude-empty-assets-plugin](https://github.com/KnisterPeter/html-webpack-exclude-empty-assets-plugin) removes empty assets from being added to the html. This fixes some problems with extract-text-plugin with webpack 4.
 * [webpack-concat-plugin](https://github.com/hxlniada/webpack-concat-plugin) for concat and uglify files that needn't to be webpack bundles(for legacy files) and inject to html-webpack-plugin.
 * [html-webpack-link-type-plugin](https://github.com/steadyapp/html-webpack-link-type-plugin) adds a configurable mimetype to resources injected as links (such as adding type="text/css" to external stylesheets) for compatibility with "strict mode". 
 * [csp-html-webpack-plugin](https://github.com/slackhq/csp-html-webpack-plugin) to add [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) meta tags to the HTML output
 * [strict-csp-html-webpack-plugin](https://github.com/google/strict-csp/tree/main/strict-csp-html-webpack-plugin) to add a [**strict** Content-Security-Policy (CSP)](https://web.dev) as a `meta` tag to the HTML output. A strict CSP is specifically efficient against XSS attacks.
 * [webpack-nomodule-plugin](https://github.com/swimmadude66/webpack-nomodule-plugin) allows you to add a `nomodule` attribute to specific injected scripts, which prevents the scripts from being loaded by newer browsers. Good for limiting loads of polyfills.
  * [html-webpack-skip-assets-plugin](https://github.com/swimmadude66/html-webpack-skip-assets-plugin) Skip adding certain output files to the html file. Built as a drop-in replacement for [html-webpack-exclude-assets-plugin](https://www.npmjs.com/package/html-webpack-exclude-assets-plugin) and works with newer [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin) versions
 * [html-webpack-inject-preload](https://github.com/principalstudio/html-webpack-inject-preload) allows to add preload links &lt;link rel='preload'> anywhere you want.
 * [inject-body-webpack-plugin](https://github.com/Jaid/inject-body-webpack-plugin) is a simple method of injecting a custom HTML string into the body.
 * [html-webpack-plugin-django](https://github.com/TommasoAmici/html-webpack-plugin-django) a Webpack plugin to inject Django static tags.


<h2 align="center">Usage</h2>

The plugin will generate an HTML5 file for you that includes all your `webpack`
bundles in the head using `script` tags. Just add the plugin to your `webpack`
config as follows:

**webpack.config.js**
```js
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin()
  ]
}
```

This will generate a file `dist/index.html` containing the following

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Webpack App</title>
    <script defer src="index_bundle.js"></script>
  </head>
  <body>
  </body>
</html>
```

If you have multiple `webpack` entry points, they will all be included with `script` tags in the generated HTML.

If you have any CSS assets in webpack's output (for example, CSS extracted with the [mini-css-extract-plugin](https://github.com/webpack-contrib/mini-css-extract-plugin))
then these will be included with `<link>` tags in the HTML head.

If you have plugins that make use of it, `html-webpack-plugin` should be ordered first before any of the integrated Plugins.

<h2 align="center">Options</h2>

You can pass a hash of configuration options to `html-webpack-plugin`.
Allowed values are as follows:

|Name|Type|Default|Description|
|:--:|:--:|:-----:|:----------|
|**`title`**|`{String}`|`Webpack App`|The title to use for the generated HTML document|
|**`filename`**|`{String\|Function}`|`'index.html'`|The file to write the HTML to. Defaults to `index.html`. You can specify a subdirectory here too (eg: `assets/admin.html`). The `[name]` placeholder will be replaced with the entry name. Can also be a function e.g. `(entryName) => entryName + '.html'`. |
|**`template`**|`{String}`|``|`webpack` relative or absolute path to the template. By default it will use `src/index.ejs` if it exists. Please see the [docs](https://github.com/jantimon/html-webpack-plugin/blob/master/docs/template-option.md) for details|
|**`templateContent`**|`{string\|Function\|false}`|false| Can be used instead of `template` to provide an inline template - please read the [Writing Your Own Templates](https://github.com/jantimon/html-webpack-plugin#writing-your-own-templates) section |
|**`templateParameters`**|`{Boolean\|Object\|Function}`| `false`| Allows to overwrite the parameters used in the template - see [example](https://github.com/jantimon/html-webpack-plugin/tree/master/examples/template-parameters) |
|**`inject`**|`{Boolean\|String}`|`true`|`true \|\| 'head' \|\| 'body' \|\| false` Inject all assets into the given `template` or `templateContent`. When passing `'body'` all javascript resources will be placed at the bottom of the body element. `'head'` will place the scripts in the head element. Passing `true` will add it to the head/body depending on the `scriptLoading` option. Passing `false` will disable automatic injections. - see the [inject:false example](https://github.com/jantimon/html-webpack-plugin/tree/master/examples/custom-insertion-position)|
|**`publicPath`**|`{String\|'auto'}`|`'auto'`|The publicPath used for script and link tags|
|**`scriptLoading`**|`{'blocking'\|'defer'\|'module'}`|`'defer'`| Modern browsers support non blocking javascript loading (`'defer'`) to improve the page startup performance. Setting to `'module'` adds attribute [`type="module"`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#applying_the_module_to_your_html). This also implies "defer", since modules are automatically deferred. |
|**`favicon`**|`{String}`|``|Adds the given favicon path to the output HTML|
|**`meta`**|`{Object}`|`{}`|Allows to inject `meta`-tags. E.g. `meta: {viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no'}`|
|**`base`**|`{Object\|String\|false}`|`false`|Inject a [`base`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base) tag. E.g. `base: "https://example.com/path/page.html`|
|**`minify`**|`{Boolean\|Object}`|`true` if `mode` is `'production'`, otherwise `false`|Controls if and in what ways the output should be minified. See [minification](#minification) below for more details.|
|**`hash`**|`{Boolean}`|`false`|If `true` then append a unique `webpack` compilation hash to all included scripts and CSS files. This is useful for cache busting|
|**`cache`**|`{Boolean}`|`true`|Emit the file only if it was changed|
|**`showErrors`**|`{Boolean}`|`true`|Errors details will be written into the HTML page|
|**`chunks`**|`{?}`|`?`|Allows you to add only some chunks (e.g only the unit-test chunk)|
|**`chunksSortMode`**|`{String\|Function}`|`auto`|Allows to control how chunks should be sorted before they are included to the HTML. Allowed values are `'none' \| 'auto' \| 'manual' \| {Function}`|
|**`excludeChunks`**|`{Array.<string>}`|``|Allows you to skip some chunks (e.g don't add the unit-test chunk)|
|**`xhtml`**|`{Boolean}`|`false`|If `true` render the `link` tags as self-closing (XHTML compliant)|

Here's an example webpack config illustrating how to use these options

**webpack.config.js**
```js
{
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'My App',
      filename: 'assets/admin.html'
    })
  ]
}
```

### Generating Multiple HTML Files

To generate more than one HTML file, declare the plugin more than
once in your plugins array

**webpack.config.js**
```js
{
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin(), // Generates default index.html
    new HtmlWebpackPlugin({  // Also generate a test.html
      filename: 'test.html',
      template: 'src/assets/test.html'
    })
  ]
}
```

### Writing Your Own Templates

If the default generated HTML doesn't meet your needs you can supply
your own template. The easiest way is to use the `template` option and pass a custom HTML file.
The html-webpack-plugin will automatically inject all necessary CSS, JS, manifest
and favicon files into the markup.

Details of other template loaders are [documented here](https://github.com/jantimon/html-webpack-plugin/blob/master/docs/template-option.md).

```js
plugins: [
  new HtmlWebpackPlugin({
    title: 'Custom template',
    // Load a custom template (lodash by default)
    template: 'index.html'
  })
]
```

**index.html**
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title><%= htmlWebpackPlugin.options.title %></title>
  </head>
  <body>
  </body>
</html>
```

If you already have a template loader, you can use it to parse the template.
Please note that this will also happen if you specify the html-loader and use `.html` file as template.

**webpack.config.js**
```js
module: {
  loaders: [
    { test: /\.hbs$/, loader: "handlebars-loader" }
  ]
},
plugins: [
  new HtmlWebpackPlugin({
    title: 'Custom template using Handlebars',
    template: 'index.hbs'
  })
]
```

You can use the `lodash` syntax out of the box. If the `inject` feature doesn't fit your needs and you want full control over the asset placement use the [default template](https://github.com/jaketrent/html-webpack-template/blob/86f285d5c790a6c15263f5cc50fd666d51f974fd/index.html) of the [html-webpack-template project](https://github.com/jaketrent/html-webpack-template) as a starting point for writing your own.

The following variables are available in the template by default (you can extend them using the `templateParameters` option):

- `htmlWebpackPlugin`: data specific to this plugin

  - `htmlWebpackPlugin.options`: the options hash that was passed to
     the plugin. In addition to the options actually used by this plugin,
     you can use this hash to pass arbitrary data through to your template.

  - `htmlWebpackPlugin.tags`: the prepared `headTags` and `bodyTags` Array to render the `<base>`, `<meta>`, `<script>` and `<link>` tags.
     Can be used directly in templates and literals. For example: 
     ```html
     <html>
       <head>
         <%= htmlWebpackPlugin.tags.headTags %>
       </head>
       <body>
         <%= htmlWebpackPlugin.tags.bodyTags %>
       </body>
     </html>
     ```
  
  - `htmlWebpackPlugin.files`: direct access to the files used during the compilation.

    ```typescript
    publicPath: string;
    js: string[];
    css: string[];
    manifest?: string;
    favicon?: string;
    ```


- `webpackConfig`: the webpack configuration that was used for this compilation. This
  can be used, for example, to get the `publicPath` (`webpackConfig.output.publicPath`).

- `compilation`: the webpack [compilation object](https://webpack.js.org/api/compilation-object/).
  This can be used, for example, to get the contents of processed assets and inline them
  directly in the page, through `compilation.assets[...].source()`
  (see [the inline template example](examples/inline/template.pug)).


The template can also be directly inlined directly into the options object.  
⚠️ **`templateContent` does not allow to use webpack loaders for your template and will not watch for template file changes**

**webpack.config.js**
```js
new HtmlWebpackPlugin({
  templateContent: `
    <html>
      <body>
        <h1>Hello World</h1>
      </body>
    </html>
  `
})
```

The `templateContent` can also access all `templateParameters` values.  
⚠️ **`templateContent` does not allow to use webpack loaders for your template and will not watch for template file changes**

**webpack.config.js**
```js
new HtmlWebpackPlugin({
  inject: false,
  templateContent: ({htmlWebpackPlugin}) => `
    <html>
      <head>
        ${htmlWebpackPlugin.tags.headTags}
      </head>
      <body>
        <h1>Hello World</h1>
        ${htmlWebpackPlugin.tags.bodyTags}
      </body>
    </html>
  `
})
```

### Filtering Chunks

To include only certain chunks you can limit the chunks being used

**webpack.config.js**
```js
plugins: [
  new HtmlWebpackPlugin({
    chunks: ['app']
  })
]
```

It is also possible to exclude certain chunks by setting the `excludeChunks` option

**webpack.config.js**
```js
plugins: [
  new HtmlWebpackPlugin({
    excludeChunks: [ 'dev-helper' ]
  })
]
```

### Minification

If the `minify` option is set to `true` (the default when webpack's `mode` is `'production'`),
the generated HTML will be minified using [html-minifier-terser](https://github.com/DanielRuf/html-minifier-terser)
and the following options:

```js
{
  collapseWhitespace: true,
  keepClosingSlash: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true
}
```

To use custom [html-minifier options](https://github.com/DanielRuf/html-minifier-terser#options-quick-reference)
pass an object to `minify` instead. This object will not be merged with the defaults above.

To disable minification during production mode set the `minify` option to `false`.

### Meta Tags

If the `meta` option is set the html-webpack-plugin will inject meta tags.  
For the default template the html-webpack-plugin will already provide a default for the `viewport` meta tag.

Please take a look at this well maintained list of almost all [possible meta tags](https://github.com/joshbuchea/HEAD#meta).

#### name/content meta tags 

Most meta tags are configured by setting a `name` and a `content` attribute.  
To add those use a key/value pair:

**webpack.config.js**
```js
plugins: [
  new HtmlWebpackPlugin({
      'meta': {
        'viewport': 'width=device-width, initial-scale=1, shrink-to-fit=no',
        // Will generate: <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        'theme-color': '#4285f4'
        // Will generate: <meta name="theme-color" content="#4285f4">
      }
  })
]
```

#### Simulate http response headers

The **http-equiv** attribute is essentially used to simulate a HTTP response header.  
This format is supported using an object notation which allows you to add any attribute:

**webpack.config.js**
```js
plugins: [
  new HtmlWebpackPlugin({
    'meta': {
      'Content-Security-Policy': { 'http-equiv': 'Content-Security-Policy', 'content': 'default-src https:' },
      // Will generate: <meta http-equiv="Content-Security-Policy" content="default-src https:">
      // Which equals to the following http header: `Content-Security-Policy: default-src https:`
      'set-cookie': { 'http-equiv': 'set-cookie', content: 'name=value; expires=date; path=url' },
      // Will generate: <meta http-equiv="set-cookie" content="value; expires=date; path=url">
      // Which equals to the following http header: `set-cookie: value; expires=date; path=url`
    }
  })
]
```

### Base Tag

When the `base` option is used,
html-webpack-plugin will inject a [base tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base).
By default, a base tag will not be injected.

The following two are identical and will both insert `<base href="http://example.com/some/page.html">`:

```js
new HtmlWebpackPlugin({
  'base': 'http://example.com/some/page.html'
})
```

```js
new HtmlWebpackPlugin({
  'base': { 'href': 'http://example.com/some/page.html' }
})
```

The `target` can be specified with the corresponding key:

```js
new HtmlWebpackPlugin({
  'base': {
    'href': 'http://example.com/some/page.html',
    'target': '_blank'
  }
})
```

which will inject the element `<base href="http://example.com/some/page.html" target="_blank">`.

### Long Term Caching

For long term caching add `contenthash` to the filename.

**Example:**

```js
plugins: [
  new HtmlWebpackPlugin({
    filename: 'index.[contenthash].html'
  })
]
```

`contenthash` is the hash of the content of the output file.

Refer webpack's [Template Strings](https://webpack.js.org/configuration/output/#template-strings) for more details

### Events

To allow other [plugins](https://github.com/webpack/docs/wiki/plugins) to alter the HTML this plugin executes
[tapable](https://github.com/webpack/tapable/tree/master) hooks.

The [lib/hooks.js](https://github.com/jantimon/html-webpack-plugin/blob/master/lib/hooks.js) contains all information
about which values are passed.

[![Concept flow uml](https://raw.githubusercontent.com/jantimon/html-webpack-plugin/master/flow.png)](https://github.com/jantimon/html-webpack-plugin/blob/master/flow.puml)

#### `beforeAssetTagGeneration` hook

```
    AsyncSeriesWaterfallHook<{
      assets: {
        publicPath: string,
        js: Array<{string}>,
        css: Array<{string}>,
        favicon?: string | undefined,
        manifest?: string | undefined
      },
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>
```

#### `alterAssetTags` hook

```
    AsyncSeriesWaterfallHook<{
      assetTags: {
        scripts: Array<HtmlTagObject>,
        styles: Array<HtmlTagObject>,
        meta: Array<HtmlTagObject>,
      },
      publicPath: string,
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>
```

#### `alterAssetTagGroups` hook

```
    AsyncSeriesWaterfallHook<{
      headTags: Array<HtmlTagObject | HtmlTagObject>,
      bodyTags: Array<HtmlTagObject | HtmlTagObject>,
      publicPath: string,
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>
```

#### `afterTemplateExecution` hook

```
    AsyncSeriesWaterfallHook<{
      html: string,
      headTags: Array<HtmlTagObject | HtmlTagObject>,
      bodyTags: Array<HtmlTagObject | HtmlTagObject>,
      outputName: string,
      plugin: HtmlWebpackPlugin,
    }>
```

#### `beforeEmit` hook

```
    AsyncSeriesWaterfallHook<{
      html: string,
      outputName: string,
      plugin: HtmlWebpackPlugin,
    }>
```

#### `afterEmit` hook

```
    AsyncSeriesWaterfallHook<{
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>
```

Example implementation: [webpack-subresource-integrity](https://www.npmjs.com/package/webpack-subresource-integrity)

**plugin.js**
```js
// If your plugin is direct dependent to the html webpack plugin:
const HtmlWebpackPlugin = require('html-webpack-plugin');
// If your plugin is using html-webpack-plugin as an optional dependency
// you can use https://github.com/tallesl/node-safe-require instead:
const HtmlWebpackPlugin = require('safe-require')('html-webpack-plugin');

class MyPlugin {
  apply (compiler) {
    compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      console.log('The compiler is starting a new compilation...')

      // Static Plugin interface |compilation |HOOK NAME | register listener 
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
        'MyPlugin', // <-- Set a meaningful name here for stacktraces
        (data, cb) => {
          // Manipulate the content
          data.html += 'The Magic Footer'
          // Tell webpack to move on
          cb(null, data)
        }
      )
    })
  }
}

module.exports = MyPlugin
```

**webpack.config.js**
```js
plugins: [
  new MyPlugin({ options: '' })
]
```

Note that the callback must be passed the HtmlWebpackPluginData in order to pass this onto any other plugins listening on the same `beforeEmit` event

<h2 align="center">Maintainers</h2>

<table>
  <tbody>
    <tr>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars3.githubusercontent.com/u/4113649?v=3&s=150">
        </br>
        <a href="https://github.com/jantimon">Jan Nicklas</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars2.githubusercontent.com/u/4112409?v=3&s=150">
        </br>
        <a href="https://github.com/mastilver">Thomas Sileghem</a>
      </td>
    </tr>
  <tbody>
</table>


## Backers

Thank you to all our backers!  
If you want to support the project as well [become a sponsor](https://opencollective.com/html-webpack-plugin#sponsor) or a [a backer](https://opencollective.com/html-webpack-plugin#backer).

<a href="https://opencollective.com/html-webpack-plugin/backer/0/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/0/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/1/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/1/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/2/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/2/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/3/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/3/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/4/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/4/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/5/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/5/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/6/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/6/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/7/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/7/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/8/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/8/avatar.svg?requireActive=false"></a>
<a href="https://opencollective.com/html-webpack-plugin/backer/9/website?requireActive=false" target="_blank"><img src="https://opencollective.com/html-webpack-plugin/backer/9/avatar.svg?requireActive=false"></a>


## Contributors

This project exists thanks to all the people who contribute.

You're free to contribute to this project by submitting [issues](https://github.com/jantimon/html-webpack-plugin/issues) and/or [pull requests](https://github.com/jantimon/html-webpack-plugin/pulls). This project is test-driven, so keep in mind that every change and new feature should be covered by tests.

This project uses the [semistandard code style](https://github.com/Flet/semistandard).

<a href="https://github.com/jantimon/html-webpack-plugin/graphs/contributors"><img src="https://opencollective.com/html-webpack-plugin/contributors.svg?width=890&button=false" /></a>


[npm]: https://img.shields.io/npm/v/html-webpack-plugin.svg
[npm-url]: https://npmjs.com/package/html-webpack-plugin

[node]: https://img.shields.io/node/v/html-webpack-plugin.svg
[node-url]: https://nodejs.org

[tests]: https://github.com/jantimon/html-webpack-plugin/workflows/CI/badge.svg
[tests-url]: https://github.com/jantimon/html-webpack-plugin/actions?query=workflow%3ACI
