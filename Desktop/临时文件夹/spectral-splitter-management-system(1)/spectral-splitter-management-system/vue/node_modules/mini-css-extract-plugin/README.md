<div align="center">
  <img width="200" height="200" src="https://cdn.worldvectorlogo.com/logos/logo-javascript.svg">
  <a href="https://webpack.js.org/">
    <img width="200" height="200" vspace="" hspace="25" src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon-square-big.svg">
  </a>
  <h1>mini-css-extract-plugin</h1>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![tests][tests]][tests-url]
[![coverage][cover]][cover-url]
[![discussion][discussion]][discussion-url]
[![size][size]][size-url]

# mini-css-extract-plugin

This plugin extracts CSS into separate files. It creates a CSS file per JS file which contains CSS. It supports On-Demand-Loading of CSS and SourceMaps.

It builds on top of a new webpack v5 feature and requires webpack 5 to work.

Compared to the extract-text-webpack-plugin:

- Async loading
- No duplicate compilation (performance)
- Easier to use
- Specific to CSS

## Getting Started

To begin, you'll need to install `mini-css-extract-plugin`:

```console
npm install --save-dev mini-css-extract-plugin
```

or

```console
yarn add -D mini-css-extract-plugin
```

or

```console
pnpm add -D mini-css-extract-plugin
```

It's recommended to combine `mini-css-extract-plugin` with the [`css-loader`](https://github.com/webpack-contrib/css-loader)

Then add the loader and the plugin to your `webpack` config. For example:

**style.css**

```css
body {
  background: green;
}
```

**component.js**

```js
import "./style.css";
```

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [new MiniCssExtractPlugin()],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

> **Warning**
>
> Note that if you import CSS from your webpack entrypoint or import styles in the [initial](https://webpack.js.org/concepts/under-the-hood/#chunks) chunk, `mini-css-extract-plugin` will not load this CSS into the page. Please use [`html-webpack-plugin`](https://github.com/jantimon/html-webpack-plugin) for automatic generation `link` tags or create `index.html` file with `link` tag.

> **Warning**
>
> Source maps works only for `source-map`/`nosources-source-map`/`hidden-nosources-source-map`/`hidden-source-map` values because CSS only supports source maps with the `sourceMappingURL` comment (i.e. `//# sourceMappingURL=style.css.map`). If you need set `devtool` to another value you can enable source maps generation for extracted CSS using [`sourceMap: true`](https://github.com/webpack-contrib/css-loader#sourcemap) for `css-loader`.

## Options

### Plugin Options

- **[`filename`](#filename)**
- **[`chunkFilename`](#chunkFilename)**
- **[`ignoreOrder`](#ignoreOrder)**
- **[`insert`](#insert)**
- **[`attributes`](#attributes)**
- **[`linkType`](#linkType)**
- **[`runtime`](#runtime)**
- **[`experimentalUseImportModule`](#experimentalUseImportModule)**

#### `filename`

Type:

```ts
type filename =
  | string
  | ((pathData: PathData, assetInfo?: AssetInfo) => string);
```

Default: `[name].css`

This option determines the name of each output CSS file.

Works like [`output.filename`](https://webpack.js.org/configuration/output/#outputfilename)

#### `chunkFilename`

Type:

```ts
type chunkFilename =
  | string
  | ((pathData: PathData, assetInfo?: AssetInfo) => string);
```

Default: `based on filename`

> Specifying `chunkFilename` as a `function` is only available in webpack@5

This option determines the name of non-entry chunk files.

Works like [`output.chunkFilename`](https://webpack.js.org/configuration/output/#outputchunkfilename)

#### `ignoreOrder`

Type:

```ts
type ignoreOrder = boolean;
```

Default: `false`

Remove Order Warnings.
See [examples](#remove-order-warnings) below for details.

#### `insert`

Type:

```ts
type insert = string | ((linkTag: HTMLLinkElement) => void);
```

Default: `document.head.appendChild(linkTag);`

Inserts the `link` tag at the given position for [non-initial (async)](https://webpack.js.org/concepts/under-the-hood/#chunks) CSS chunks

> **Warning**
>
> Only for [non-initial (async)](https://webpack.js.org/concepts/under-the-hood/#chunks) chunks.

By default, the `mini-css-extract-plugin` appends styles (`<link>` elements) to `document.head` of the current `window`.

However in some circumstances it might be necessary to have finer control over the append target or even delay `link` elements insertion.
For example this is the case when you asynchronously load styles for an application that runs inside of an iframe.
In such cases `insert` can be configured to be a function or a custom selector.

If you target an [iframe](https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement) make sure that the parent document has sufficient access rights to reach into the frame document and append elements to it.

##### `string`

Allows to setup custom [query selector](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector).
A new `<link>` element will be inserted after the found item.

**webpack.config.js**

```js
new MiniCssExtractPlugin({
  insert: "#some-element",
});
```

A new `<link>` element will be inserted after the element with id `some-element`.

##### `function`

Allows to override default behavior and insert styles at any position.

> ⚠ Do not forget that this code will run in the browser alongside your application. Since not all browsers support latest ECMA features like `let`, `const`, `arrow function expression` and etc we recommend you to use only ECMA 5 features and syntax.

> > ⚠ The `insert` function is serialized to string and passed to the plugin. This means that it won't have access to the scope of the webpack configuration module.

**webpack.config.js**

```js
new MiniCssExtractPlugin({
  insert: function (linkTag) {
    var reference = document.querySelector("#some-element");
    if (reference) {
      reference.parentNode.insertBefore(linkTag, reference);
    }
  },
});
```

A new `<link>` element will be inserted before the element with id `some-element`.

#### `attributes`

Type:

```ts
type attributes = Record<string, string>};
```

Default: `{}`

> **Warning**
>
> Only for [non-initial (async)](https://webpack.js.org/concepts/under-the-hood/#chunks) chunks.

If defined, the `mini-css-extract-plugin` will attach given attributes with their values on `<link>` element.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      attributes: {
        id: "target",
        "data-target": "example",
      },
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

> **Note**
>
> It's only applied to dynamically loaded css chunks, if you want to modify link attributes inside html file, please using [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin)

#### `linkType`

Type:

```ts
type linkType = string | boolean;
```

Default: `text/css`

This option allows loading asynchronous chunks with a custom link type, such as `<link type="text/css" ...>`.

##### `string`

Possible values: `text/css`

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      linkType: "text/css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

##### `boolean`

`false` disables the link `type` attribute

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      linkType: false,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

#### `runtime`

Type:

```ts
type runtime = boolean;
```

Default: `true`

Allows to enable/disable the runtime generation.
CSS will be still extracted and can be used for a custom loading methods.
For example, you can use [assets-webpack-plugin](https://github.com/ztoben/assets-webpack-plugin) to retrieve them then use your own runtime code to download assets when needed.

`false` to skip.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      runtime: false,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

#### `experimentalUseImportModule`

Type:

```ts
type experimentalUseImportModule = boolean;
```

Default: `undefined`

Enabled by default if not explicitly enabled (i.e. `true` and `false` allow you to explicitly control this option) and new API is available (at least webpack `5.52.0` is required).
Boolean values are available since version `5.33.2`, but you need to enable `experiments.executeModule` (not required from webpack `5.52.0`).

Use a new webpack API to execute modules instead of child compilers.
This improves performance and memory usage a lot.

When combined with `experiments.layers`, this adds a `layer` option to the loader options to specify the layer of the css execution.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      // You don't need this for `>= 5.52.0` due to the fact that this is enabled by default
      // Required only for `>= 5.33.2 & <= 5.52.0`
      // Not available/unsafe for `<= 5.33.2`
      experimentalUseImportModule: true,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

### Loader Options

- **[`publicPath`](#publicPath)**
- **[`emit`](#emit)**
- **[`esModule`](#esModule)**

#### `publicPath`

Type:

```ts
type publicPath =
  | string
  | ((resourcePath: string, rootContext: string) => string);
```

Default: the `publicPath` in `webpackOptions.output`

Specifies a custom public path for the external resources like images, files, etc inside `CSS`.
Works like [`output.publicPath`](https://webpack.js.org/configuration/output/#outputpublicpath)

##### `string`

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[name].css",
      chunkFilename: "[id].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: "/public/path/to/",
            },
          },
          "css-loader",
        ],
      },
    ],
  },
};
```

##### `function`

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[name].css",
      chunkFilename: "[id].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: (resourcePath, context) => {
                return path.relative(path.dirname(resourcePath), context) + "/";
              },
            },
          },
          "css-loader",
        ],
      },
    ],
  },
};
```

#### `emit`

Type:

```ts
type emit = boolean;
```

Default: `true`

If true, emits a file (writes a file to the filesystem). If false, the plugin will extract the CSS but **will not** emit the file.
It is often useful to disable this option for server-side packages.

#### `esModule`

Type:

```ts
type esModule = boolean;
```

Default: `true`

By default, `mini-css-extract-plugin` generates JS modules that use the ES modules syntax.
There are some cases in which using ES modules is beneficial, like in the case of [module concatenation](https://webpack.js.org/plugins/module-concatenation-plugin/) and [tree shaking](https://webpack.js.org/guides/tree-shaking/).

You can enable a CommonJS syntax using:

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [new MiniCssExtractPlugin()],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              esModule: false,
            },
          },
          "css-loader",
        ],
      },
    ],
  },
};
```

## Examples

### Recommended

For `production` builds it's recommended to extract the CSS from your bundle being able to use parallel loading of CSS/JS resources later on.
This can be achieved by using the `mini-css-extract-plugin`, because it creates separate css files.
For `development` mode (including `webpack-dev-server`) you can use [style-loader](https://github.com/webpack-contrib/style-loader), because it injects CSS into the DOM using multiple <style></style> and works faster.

> Do not use `style-loader` and `mini-css-extract-plugin` together.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const devMode = process.env.NODE_ENV !== "production";

module.exports = {
  module: {
    rules: [
      {
        // If you enable `experiments.css` or `experiments.futureDefaults`, please uncomment line below
        // type: "javascript/auto",
        test: /\.(sa|sc|c)ss$/,
        use: [
          devMode ? "style-loader" : MiniCssExtractPlugin.loader,
          "css-loader",
          "postcss-loader",
          "sass-loader",
        ],
      },
    ],
  },
  plugins: [].concat(devMode ? [] : [new MiniCssExtractPlugin()]),
};
```

### Minimal example

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // all options are optional
      filename: "[name].css",
      chunkFilename: "[id].css",
      ignoreOrder: false, // Enable to remove warnings about conflicting order
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              // you can specify a publicPath here
              // by default it uses publicPath in webpackOptions.output
              publicPath: "../",
            },
          },
          "css-loader",
        ],
      },
    ],
  },
};
```

### Named export for CSS Modules

> ⚠ Names of locals are converted to `camelCase`.

> ⚠ It is not allowed to use JavaScript reserved words in css class names.

> ⚠ Options `esModule` and `modules.namedExport` in `css-loader` should be enabled.

**styles.css**

```css
.foo-baz {
  color: red;
}
.bar {
  color: blue;
}
```

**index.js**

```js
import { fooBaz, bar } from "./styles.css";

console.log(fooBaz, bar);
```

You can enable a ES module named export using:

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [new MiniCssExtractPlugin()],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: "css-loader",
            options: {
              esModule: true,
              modules: {
                namedExport: true,
                localIdentName: "foo__[name]__[local]",
              },
            },
          },
        ],
      },
    ],
  },
};
```

### The `publicPath` option as function

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[name].css",
      chunkFilename: "[id].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: (resourcePath, context) => {
                // publicPath is the relative path of the resource to the context
                // e.g. for ./css/admin/main.css the publicPath will be ../../
                // while for ./css/main.css the publicPath will be ../
                return path.relative(path.dirname(resourcePath), context) + "/";
              },
            },
          },
          "css-loader",
        ],
      },
    ],
  },
};
```

### Advanced configuration example

This plugin should not be used with `style-loader` in the loaders chain.

Here is an example to have both HMR in `development` and your styles extracted in a file for `production` builds.

(Loaders options left out for clarity, adapt accordingly to your needs.)

You should not use `HotModuleReplacementPlugin` plugin if you are using a `webpack-dev-server`.
`webpack-dev-server` enables / disables HMR using `hot` option.

**webpack.config.js**

```js
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const devMode = process.env.NODE_ENV !== "production";

const plugins = [
  new MiniCssExtractPlugin({
    // Options similar to the same options in webpackOptions.output
    // both options are optional
    filename: devMode ? "[name].css" : "[name].[contenthash].css",
    chunkFilename: devMode ? "[id].css" : "[id].[contenthash].css",
  }),
];
if (devMode) {
  // only enable hot in development
  plugins.push(new webpack.HotModuleReplacementPlugin());
}

module.exports = {
  plugins,
  module: {
    rules: [
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          "postcss-loader",
          "sass-loader",
        ],
      },
    ],
  },
};
```

### Hot Module Reloading (HMR)

> **Note**
>
> HMR is automatically supported in webpack 5. No need to configure it. Skip the following:

The `mini-css-extract-plugin` supports hot reloading of actual css files in development.
Some options are provided to enable HMR of both standard stylesheets and locally scoped CSS or CSS modules.
Below is an example configuration of mini-css for HMR use with CSS modules.

You should not use `HotModuleReplacementPlugin` plugin if you are using a `webpack-dev-server`.
`webpack-dev-server` enables / disables HMR using `hot` option.

**webpack.config.js**

```js
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const plugins = [
  new MiniCssExtractPlugin({
    // Options similar to the same options in webpackOptions.output
    // both options are optional
    filename: devMode ? "[name].css" : "[name].[contenthash].css",
    chunkFilename: devMode ? "[id].css" : "[id].[contenthash].css",
  }),
];
if (devMode) {
  // only enable hot in development
  plugins.push(new webpack.HotModuleReplacementPlugin());
}

module.exports = {
  plugins,
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {},
          },
          "css-loader",
        ],
      },
    ],
  },
};
```

### Minimizing For Production

To minify the output, use a plugin like [css-minimizer-webpack-plugin](https://github.com/webpack-contrib/css-minimizer-webpack-plugin).

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
      chunkFilename: "[id].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  optimization: {
    minimizer: [
      // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
      // `...`,
      new CssMinimizerPlugin(),
    ],
  },
};
```

This will enable CSS optimization only in production mode. If you want to run it also in development set the `optimization.minimize` option to true.

### Using preloaded or inlined CSS

The runtime code detects already added CSS via `<link>` or `<style>` tag.
This can be useful when injecting CSS on server-side for Server-Side-Rendering.
The `href` of the `<link>` tag has to match the URL that will be used for loading the CSS chunk.
The `data-href` attribute can be used for `<link>` and `<style>` too.
When inlining CSS `data-href` must be used.

### Extracting all CSS in a single file

The CSS can be extracted in one CSS file using `optimization.splitChunks.cacheGroups`.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  optimization: {
    splitChunks: {
      cacheGroups: {
        styles: {
          name: "styles",
          type: "css/mini-extract",
          chunks: "all",
          enforce: true,
        },
      },
    },
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

Note that `type` should be used instead of `test` in Webpack 5, or else an extra `.js` file can be generated besides the `.css` file. This is because `test` doesn't know which modules should be dropped (in this case, it won't detect that `.js` should be dropped).

### Extracting CSS based on entry

You may also extract the CSS based on the webpack entry name.
This is especially useful if you import routes dynamically but want to keep your CSS bundled according to entry.
This also prevents the CSS duplication issue one had with the ExtractTextPlugin.

```js
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: {
    foo: path.resolve(__dirname, "src/foo"),
    bar: path.resolve(__dirname, "src/bar"),
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        fooStyles: {
          type: "css/mini-extract",
          name: "styles_foo",
          chunks: (chunk) => {
            return chunk.name === "foo";
          },
          enforce: true,
        },
        barStyles: {
          type: "css/mini-extract",
          name: "styles_bar",
          chunks: (chunk) => {
            return chunk.name === "bar";
          },
          enforce: true,
        },
      },
    },
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

### Filename Option as function

With the `filename` option you can use chunk data to customize the filename.
This is particularly useful when dealing with multiple entry points and wanting to get more control out of the filename for a given entry point/chunk.
In the example below, we'll use `filename` to output the generated css into a different directory.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      filename: ({ chunk }) => `${chunk.name.replace("/js/", "/css/")}.css`,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

### Long Term Caching

For long term caching use `filename: "[contenthash].css"`. Optionally add `[name]`.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
      chunkFilename: "[id].[contenthash].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

### Remove Order Warnings

For projects where css ordering has been mitigated through consistent use of scoping or naming conventions, such as [CSS Modules](https://github.com/css-modules/css-modules), the css order warnings can be disabled by setting the ignoreOrder flag to true for the plugin.

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      ignoreOrder: true,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
```

### Multiple Themes

**webpack.config.js**

```js
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: "./src/index.js",
  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        oneOf: [
          {
            resourceQuery: "?dark",
            use: [
              MiniCssExtractPlugin.loader,
              "css-loader",
              {
                loader: "sass-loader",
                options: {
                  additionalData: `@use 'dark-theme/vars' as vars;`,
                },
              },
            ],
          },
          {
            use: [
              MiniCssExtractPlugin.loader,
              "css-loader",
              {
                loader: "sass-loader",
                options: {
                  additionalData: `@use 'light-theme/vars' as vars;`,
                },
              },
            ],
          },
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
      attributes: {
        id: "theme",
      },
    }),
  ],
};
```

**src/index.js**

```js
import "./style.scss";

let theme = "light";
const themes = {};

themes[theme] = document.querySelector("#theme");

async function loadTheme(newTheme) {
  // eslint-disable-next-line no-console
  console.log(`CHANGE THEME - ${newTheme}`);

  const themeElement = document.querySelector("#theme");

  if (themeElement) {
    themeElement.remove();
  }

  if (themes[newTheme]) {
    // eslint-disable-next-line no-console
    console.log(`THEME ALREADY LOADED - ${newTheme}`);

    document.head.appendChild(themes[newTheme]);

    return;
  }

  if (newTheme === "dark") {
    // eslint-disable-next-line no-console
    console.log(`LOADING THEME - ${newTheme}`);

    import(/* webpackChunkName: "dark" */ "./style.scss?dark").then(() => {
      themes[newTheme] = document.querySelector("#theme");

      // eslint-disable-next-line no-console
      console.log(`LOADED - ${newTheme}`);
    });
  }
}

document.onclick = () => {
  if (theme === "light") {
    theme = "dark";
  } else {
    theme = "light";
  }

  loadTheme(theme);
};
```

**src/dark-theme/\_vars.scss**

```scss
$background: black;
```

**src/light-theme/\_vars.scss**

```scss
$background: white;
```

**src/styles.scss**

```scss
body {
  background-color: vars.$background;
}
```

**public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Document</title>
    <link id="theme" rel="stylesheet" type="text/css" href="./main.css" />
  </head>
  <body>
    <script src="./main.js"></script>
  </body>
</html>
```

### Media Query Plugin

If you'd like to extract the media queries from the extracted CSS (so mobile users don't need to load desktop or tablet specific CSS anymore) you should use one of the following plugins:

- [Media Query Plugin](https://github.com/SassNinja/media-query-plugin)
- [Media Query Splitting Plugin](https://github.com/mike-diamond/media-query-splitting-plugin)

## Contributing

Please take a moment to read our contributing guidelines if you haven't yet done so.

[CONTRIBUTING](./.github/CONTRIBUTING.md)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/mini-css-extract-plugin.svg
[npm-url]: https://npmjs.com/package/mini-css-extract-plugin
[node]: https://img.shields.io/node/v/mini-css-extract-plugin.svg
[node-url]: https://nodejs.org
[tests]: https://github.com/webpack-contrib/mini-css-extract-plugin/workflows/mini-css-extract-plugin/badge.svg
[tests-url]: https://github.com/webpack-contrib/mini-css-extract-plugin/actions
[cover]: https://codecov.io/gh/webpack-contrib/mini-css-extract-plugin/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/mini-css-extract-plugin
[discussion]: https://img.shields.io/github/discussions/webpack/webpack
[discussion-url]: https://github.com/webpack/webpack/discussions
[size]: https://packagephobia.now.sh/badge?p=mini-css-extract-plugin
[size-url]: https://packagephobia.now.sh/result?p=mini-css-extract-plugin
