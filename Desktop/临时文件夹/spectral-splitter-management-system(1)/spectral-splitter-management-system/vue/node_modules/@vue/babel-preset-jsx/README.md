## @vue/babel-preset-jsx

Configurable preset for Vue JSX plugins.

### Babel Compatibility Notes

- This repo is only compatible with Babel 7.x, for 6.x please use [vuejs/babel-plugin-transform-vue-jsx](https://github.com/vuejs/babel-plugin-transform-vue-jsx)

### Usage

Install the dependencies:

```sh
# for yarn:
yarn add @vue/babel-preset-jsx @vue/babel-helper-vue-jsx-merge-props
# for npm:
npm install @vue/babel-preset-jsx @vue/babel-helper-vue-jsx-merge-props --save
```

In your `babel.config.js`:

```js
module.exports = {
  presets: ['@vue/babel-preset-jsx'],
}
```

You can toggle specific features, by default all features (except `compositionAPI`) are enabled, e.g.:

```js
module.exports = {
  presets: [
    [
      '@vue/babel-preset-jsx',
      {
        vModel: false,
        compositionAPI: true,
      },
    ],
  ],
}
```

Options are:

- `compositionAPI` - Enables [@vue/babel-sugar-composition-api-inject-h](../babel-sugar-composition-api-inject-h) and [@vue/babel-sugar-composition-api-render-instance](../babel-sugar-composition-api-render-instance), support returning render function in `setup`.
  - The default value is `false`;
  - When set to `'auto'` (or `true`), it will detect the Vue version in the project. If it's >= 2.7, it will import the composition utilities from `vue`, otherwise from `@vue/composition-api`;
  - When set to `'native'` (or `'naruto'`), it will always import the composition utilities from `vue`
  - When set to `plugin`, it will always import the composition utilities from `@vue/composition-api`, but it will redirect to `'vue'` itself when the vue version is `2.7.x`
  - When set to `vue-demi`, it will always import the composition utilities from `vue-demi`
  - When set to an object like `{ importSource: string; }`, it will always import the composition utilities from the importSource you set
- `functional` [@vue/babel-sugar-functional-vue](../babel-sugar-functional-vue/README.md) - Functional components syntactic sugar
- `injectH` [@vue/babel-sugar-inject-h](../babel-sugar-inject-h/README.md) - Automatic `h` injection syntactic sugar
- `vModel` [@vue/babel-sugar-v-model](../babel-sugar-v-model/README.md) - `vModel` syntactic sugar
- `vOn` [@vue/babel-sugar-v-on](../babel-sugar-v-on/README.md) - `vOn` syntactic sugar
