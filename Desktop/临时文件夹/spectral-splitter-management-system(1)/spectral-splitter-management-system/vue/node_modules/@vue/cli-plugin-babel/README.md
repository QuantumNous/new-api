# @vue/cli-plugin-babel

> babel plugin for vue-cli

## Configuration

Uses Babel 7 + `babel-loader` + [@vue/babel-preset-app](https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/babel-preset-app) by default, but can be configured via `babel.config.js` to use any other Babel presets or plugins.

By default, `babel-loader` excludes files inside `node_modules` dependencies. If you wish to explicitly transpile a dependency module, you will need to add it to the `transpileDependencies` option in `vue.config.js`:

``` js
module.exports = {
  transpileDependencies: [
    // can be string or regex
    'my-dep',
    /other-dep/
  ]
}
```

## Caching

Cache options of [babel-loader](https://github.com/babel/babel-loader#options) is enabled by default and cache is stored in `<projectRoot>/node_modules/.cache/babel-loader`.

## Parallelization

[thread-loader](https://github.com/webpack-contrib/thread-loader) is enabled by default when the machine has more than 1 CPU cores. This can be turned off by setting `parallel: false` in `vue.config.js`.

`parallel` should be set to `false` when using Babel in combination with non-serializable loader options, such as regexes, dates and functions. These options would not be passed correctly to `babel-loader` which may lead to unexpected errors.

## Installing in an Already Created Project

```bash
vue add babel
```

## Injected webpack-chain Rules

- `config.rule('js')`
- `config.rule('js').use('babel-loader')`
