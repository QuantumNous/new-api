> A webpack plugin for Semi Design to custom theme、replace prefix and so on.

## Introduction
The plugin is designed for Semi Design, support webpack4 and webpack5, provides two major abilities:
- Custom theme
- Replace prefix of CSS selector 

## Usage 

### Install 
Install `@douyinfe/semi-webpack-plugin` as a development dependency:

``` shell
npm install --save-dev @douyinfe/semi-webpack-plugin
# or
yarn add --dev @douyinfe/semi-webpack-plugin
```

### Custom theme
Semi Design uses the Scss variables to extract thousands of Design Tokens. You can replace Token through this plugin to achieve theme customization. [More info](https://semi.design/dsm/)

You can custom theme through three ways:
- npm package for custom theme
- Local Scss file in your project
- Pass key-value pair parameters to plugin 
Priority from low to high.
#### Through npm package 

In order to use the npm package, you need to customize the theme through [Semi Design System](https://semi.design/dsm/).After finishing the customization, Semi DSM will generate a npm package for you, and then you can use it like this.

``` js
// webpack.config.js
const SemiPlugin = require('@douyinfe/semi-webpack-plugin').default;

module.exports = {
    // ...
    plugins: [
        new SemiPlugin({
            theme: '@douyinfe/semi-theme-default'
        })
    ]
    // ...
};
```

#### Through local Scss file

You can check which tokens can be customized on the [Semi WebSite](https://semi.design/en-US/basic/tokens).

- step1: add a local file
``` scss
// local.scss
$font-size-small: 16px;

```
- step2: config webpack
``` js
// webpack.config.js
const path = require('path');
const SemiPlugin = require('@douyinfe/semi-webpack-plugin').default;

module.exports = {
    // ...
    plugins: [
        new SemiPlugin({
            include: path.join(__dirname, 'local.scss')
        })
    ]
};
```

#### Through parameters
``` js
// webpack.config.js
const SemiPlugin = require('@douyinfe/semi-webpack-plugin').default;

module.exports = {
    // ...
    plugins: [
        new SemiPlugin({
            variables: {
                "$font-size-small": '16px'
            }
        })
    ]
};
```

### Replace prefix of CSS selector
The CSS selectors used by Semi Design is prefixed with semi by default(e.g, `.semi-button`).You can replace the prefix through this plugin.

``` js
// webpack.config.js
const SemiPlugin = require('@douyinfe/semi-webpack-plugin').default;

module.exports = {
    // ...
    plugins: [
        new SemiPlugin({
            prefixCls: 'custom'
        })
    ]
    // ...
};
```

Then you get the replaced CSS selectors(e.g, `.custom-button`).

## Api
### new SemiPlugin(options)

#### options.prefixCls

Type: `String`

The prefix of CSS selector.

#### options.theme

Type: `String` or `Object`

When the type is string, it represents the name of npm for custom theme.You can use [Semi Design System](https://semi.design) to custom theme.

##### options.theme.name

Same performance as when the type of `options.theme` is string.

##### options.include

Type: `String`

The absolute path of the local Scss file.

##### options.variables

Type: `Object`

The key-value pair of Scss token.

##### options.omitCss

Type: `Boolean`

In the compilation phase, whether to exclude css references.Used to solve the problem that Next.js does not support the global introduction of css in third-party code.See this [discussion](https://github.com/vercel/next.js/discussions/27953).

##### options.webpackContext.NormalModule

Type: `webpack NormalModule`

##### options.extractCssOptions.loader

Type: `String`

The path of webpack loader that extract css.

##### options.extractCssOptions.loaderOptions

Type: `Object`

The options of webpack loader that extract css.

#### options.overrideStylesheetLoaders

Type: `(loaderList:any[])=>any[]`

You can customize how webpack process semi related styles by override the loader with this option. The function will receive the loader list of default loaders(include options.extractCssOptions) and you should return your new loader list. The best practice is just only add your loader to the list rather than delete or change the default loaders since some core logic is in there.


In webpack@5, some hooks need to be obtained through api `NormalModule.getCompilationHooks`. But in some scenarios, webpack will not be installed, such as Next.js. Therefore, the user is required to pass in NormalModule as a parameter.