# @vue/babel-preset-app

This is the default Babel preset used in all Vue CLI projects. **Note: this preset is meant to be used exclusively in projects created via Vue CLI and does not consider external use cases.**

## Included Features

### [@babel/preset-env](https://new.babeljs.io/docs/en/next/babel-preset-env.html)

`preset-env` automatically determines the transforms and polyfills to apply based on your browser target. See [Browser Compatibility](https://cli.vuejs.org/guide/browser-compatibility.html) section in docs for more details.

- `modules: false`
  - auto set to `'commonjs'` in Jest tests
- [`useBuiltIns: 'usage'`](#usebuiltins)
- `targets`:
  - by default `@babel/preset-env` will use [`browserslist config sources`](https://github.com/browserslist/browserslist#queries) (browserslist key in package.json file is recommend) unless either the [`targets`](https://babeljs.io/docs/en/babel-preset-env#targets) or [`ignoreBrowserslistConfig`](https://babeljs.io/docs/en/babel-preset-env#ignorebrowserslistconfig) options are set.
  - set to `{ node: 'current' }` when running unit tests in Node.js
- Includes `Promise` polyfill by default so that they are usable even in non-transpiled dependencies (only for environments that need it)

### Stage 3 or Below

Only the following stage 3 or below features are supported (object rest spread is supported as part of `preset-env`):

- [Dynamic Import Syntax](https://github.com/tc39/proposal-dynamic-import)
- [Proposal Class Properties](https://babeljs.io/docs/en/next/babel-plugin-proposal-class-properties.html)
- [Proposal Decorators (legacy)](https://babeljs.io/docs/en/next/babel-plugin-proposal-decorators.html)

If you need additional stage 3 or below features, you need to install and configure it yourself.

### Vue JSX support

- [@babel/plugin-syntax-jsx](https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-jsx)
- [@vue/babel-preset-jsx](https://github.com/vuejs/jsx)

### [@babel/plugin-transform-runtime](https://github.com/babel/babel/tree/master/packages/babel-plugin-transform-runtime)

`transform-runtime` avoids inlining helpers in every file. This is enabled for helpers only, since polyfills are handled by `babel-preset-env`.

## Options

- All options from [@babel/preset-env](https://babeljs.io/docs/en/next/babel-preset-env.html) are supported, with some of them having smarter defaults.

### modules

- Default:
  - `false` when building with webpack
  - `'commonjs'` when running tests in Jest.

Explicitly set `modules` option for `babel-preset-env`. See [babel-preset-env docs](https://github.com/babel/babel/tree/master/packages/babel-preset-env#modules) for more details.

### targets

- Default:
  - `@vue/babel-preset-app` will use [`browserslist config sources`](https://github.com/browserslist/browserslist#queries) (browserslist key in package.json file is recommend) unless either the [`targets`](https://babeljs.io/docs/en/babel-preset-env#targets) or [`ignoreBrowserslistConfig`](https://babeljs.io/docs/en/babel-preset-env#ignorebrowserslistconfig) options are set.
  - set to `{ node: 'current' }` when running unit tests in Node.js

Explicitly set `targets` option for `babel-preset-env`. See [babel-preset-env docs](https://github.com/babel/babel/tree/master/packages/babel-preset-env#targets) for more details.

### useBuiltIns

- Default: `'usage'`
- Allowed values: `'usage' | 'entry' | false`

Explicitly set `useBuiltIns` option for `babel-preset-env`.

The default value is `'usage'`, which adds imports to polyfills based on the usage in transpiled code. For example, if you use `Object.assign` in your code, the corresponding polyfill will be auto-imported if your target environment does not supports it.

If you are building a library or web component instead of an app, you probably want to set this to `false` and let the consuming app be responsible for the polyfills.

Note that the usage detection does not apply to your dependencies (which are excluded by `cli-plugin-babel` by default). If one of your dependencies need polyfills, you have a few options:

1. **If the dependency is written in an ES version that your target environments do not support:** Add that dependency to the `transpileDependencies` option in `vue.config.js`. This would enable both syntax transforms and usage-based polyfill detection for that dependency.

2. **If the dependency ships ES5 code and explicitly lists the polyfills needed:** you can pre-include the needed polyfills using the [polyfills](#polyfills) option for this preset.

3. **If the dependency ships ES5 code, but uses ES6+ features without explicitly listing polyfill requirements (e.g. Vuetify):** Use `useBuiltIns: 'entry'` and then add `import '@babel/polyfill'` to your entry file. This will import **ALL** polyfills based on your `browserslist` targets so that you don't need to worry about dependency polyfills anymore, but will likely increase your final bundle size with some unused polyfills.

See [@babel/preset-env docs](https://new.babeljs.io/docs/en/next/babel-preset-env.html#usebuiltins-usage) for more details.

### polyfills

- Default: `['es.array.iterator', 'es.promise', 'es.object.assign', 'es.promise.finally']`

A list of [core-js](https://github.com/zloirock/core-js) polyfills to pre-include when using `useBuiltIns: 'usage'`. **These polyfills are automatically excluded if they are not needed for your target environments**.

Use this option when you have 3rd party dependencies that are not processed by Babel but have specific polyfill requirements (e.g. Axios and Vuex require Promise support).

### jsx

- Default: `true`.

Set to `false` to disable JSX support. Or you can toggle [@vue/babel-preset-jsx](https://github.com/vuejs/jsx/tree/dev/packages/babel-preset-jsx) (or [@vue/babel-plugin-jsx](https://github.com/vuejs/jsx-next) for Vue 3 projects) features here.

### loose

- Default: `false`.

Setting this to `true` will generate code that is more performant but less spec-compliant.

### entryFiles

- Default: `[]`

Multi page repo use `entryFiles` to ensure inject polyfills to all entry file.
