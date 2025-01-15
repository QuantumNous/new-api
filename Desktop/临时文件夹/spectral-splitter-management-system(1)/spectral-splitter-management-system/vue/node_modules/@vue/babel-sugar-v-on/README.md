## @vue/babel-sugar-v-on

Syntactic sugar for v-on in JSX.

### Babel Compatibility Notes

- This repo is only compatible with Babel 7.x, for 6.x please use [vuejs/babel-plugin-transform-vue-jsx](https://github.com/vuejs/babel-plugin-transform-vue-jsx)

### Usage

Install the dependencies:

```sh
# for yarn:
yarn add @vue/babel-sugar-v-on
# for npm:
npm install @vue/babel-sugar-v-on --save
```

In your `.babelrc`:

```json
{
  "plugins": ["@vue/babel-sugar-v-on"]
}
```

However it is recommended to use the [configurable preset](../babel-preset-jsx/README.md) instead.

### Details

This plugin adds v-on to the JSX and tries to mirror the same behaviour as in vue-template-compiler, with a few differences:

1.  You should use underscore (`_`) instead of dot (`.`) for modifiers (`vOn:click_prevent={this.test}`)
2.  It is recommended to use camelCase version of it (`vOn`) in JSX, but you can use kebab-case too (`v-on`).

```js
export default {
  methods: {
    test() {
      console.log('Hello World')
    },
  },
  render(h) {
    return (
      <div>
        <a href="https://vuejs.org" vOn:click={this.test}>Vue</a>
      </div>
    )
  },
}
```
