## @vue/babel-sugar-functional-vue

Syntactic sugar for functional components.

### Babel Compatibility Notes

- This repo is only compatible with Babel 7.x, for 6.x please use [vuejs/babel-plugin-transform-vue-jsx](https://github.com/vuejs/babel-plugin-transform-vue-jsx)

### Usage

Install the dependencies:

```sh
# for yarn:
yarn add @vue/babel-sugar-functional-vue
# for npm:
npm install @vue/babel-sugar-functional-vue --save
```

In your `.babelrc`:

```json
{
  "plugins": ["@vue/babel-sugar-functional-vue"]
}
```

However it is recommended to use the [configurable preset](../babel-preset-jsx/README.md) instead.

### Details

This plugin transpiles arrow functions that return JSX into functional components but only if it's an uppercase variable declaration or default export:

```js
// Original:
export const A = ({ props, listeners }) => <div onClick={listeners.click}>{props.msg}</div>
export const b = ({ props, listeners }) => <div onClick={listeners.click}>{props.msg}</div>
export default ({ props, listeners }) => <div onClick={listeners.click}>{props.msg}</div>

// Result:
export const A = {
  functional: true,
  render: (h, {
    props,
    listeners
  }) => <div onClick={listeners.click}>{props.msg}</div>
}
export const b = ({ props, listeners }) => <div onClick={listeners.click}>{props.msg}</div>
export default {
  functional: true,
  render: (h, {
    props,
    listeners
  }) => <div onClick={listeners.click}>{props.msg}</div>
}
```
