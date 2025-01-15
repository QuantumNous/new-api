## @vue/babel-sugar-v-model

Syntactic sugar for v-model in JSX.

### Babel Compatibility Notes

- This repo is only compatible with Babel 7.x, for 6.x please use [vuejs/babel-plugin-transform-vue-jsx](https://github.com/vuejs/babel-plugin-transform-vue-jsx)

### Usage

Install the dependencies:

```sh
# for yarn:
yarn add @vue/babel-sugar-v-model
# for npm:
npm install @vue/babel-sugar-v-model --save
```

In your `.babelrc`:

```json
{
  "plugins": ["@vue/babel-sugar-v-model"]
}
```

However it is recommended to use the [configurable preset](../babel-preset-jsx/README.md) instead.

### Details

This plugin adds v-model to the JSX and tries to mirror the same behaviour as in vue-template-compiler, with a few differences:

1.  You should use underscore (`_`) instead of dot (`.`) for modifiers (`vModel_trim={this.test}`)
2.  It is recommended to use camelCase version of it (`vModel`) in JSX, but you can use kebab-case too (`v-model`).

```js
export default {
  data: () => ({
    test: 'Hello World',
  }),
  render(h) {
    return (
      <div>
        <input type="text" vModel_trim={this.test} />
        {this.test}
      </div>
    )
  },
}
```
