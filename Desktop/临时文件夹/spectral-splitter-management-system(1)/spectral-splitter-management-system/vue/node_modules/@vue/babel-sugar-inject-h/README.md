## @vue/babel-sugar-inject-h

Syntactic sugar for automatic `h` inject in JSX.

### Babel Compatibility Notes

- This repo is only compatible with Babel 7.x, for 6.x please use [vuejs/babel-plugin-transform-vue-jsx](https://github.com/vuejs/babel-plugin-transform-vue-jsx)

### Usage

Install the dependencies:

```sh
# for yarn:
yarn add @vue/babel-sugar-inject-h
# for npm:
npm install @vue/babel-sugar-inject-h --save
```

In your `.babelrc`:

```json
{
  "plugins": ["@vue/babel-sugar-inject-h"]
}
```

However it is recommended to use the [configurable preset](../babel-preset-jsx/README.md) instead.

### Details

This plugin automatically injects `h` in every method that has JSX. By using this plugin you don't have to always specifically declare `h` as first parameter in your `render()` function.

```js
// Without @vue/babel-sugar-inject-h
export default {
  render (h) {
    return <button />
  }
}

// With @vue/babel-sugar-inject-h
export default {
  render () {
    return <button />
  }
}
```
