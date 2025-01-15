## @vue/babel-sugar-composition-api-render-instance

> Ported from [luwanquan/babel-preset-vca-jsx](https://github.com/luwanquan/babel-preset-vca-jsx) by [@luwanquan](https://github.com/luwanquan)

Babel syntactic sugar for replacing `this` with `getCurrentInstance()` in Vue JSX with @vue/composition-api

### Babel Compatibility Notes

- This repo is only compatible with Babel 7.x

### Usage

Install the dependencies:

```sh
# for yarn:
yarn add @vue/babel-sugar-composition-api-render-instance
# for npm:
npm install @vue/babel-sugar-composition-api-render-instance --save
```

In your `.babelrc`:

```json
{
  "plugins": ["@vue/babel-sugar-composition-api-render-instance"]
}
```

However it is recommended to use the [configurable preset](../babel-preset-jsx/README.md) instead.

### Details

This plugin automatically replaces `this` in `setup()` with `getCurrentInstance()`. This is required for JSX to work in @vue/composition-api as `this` is not available in `setup()`

Input:

```jsx
defineComponent({ 
  setup() {
    return () => <MyComponent vModel={a.b} />
  }
})
```

Output (without @vue/babel-sugar-composition-api-render-instance):

```jsx
defineComponent({
  setup() {
    return () => <MyComponent model={{
      value: a.b,
      callback: $$v => {
        this.$set(a, "b", $$v);
      }
    }} />
  }
})
```

Output (with @vue/babel-sugar-composition-api-render-instance):

```jsx
import { getCurrentInstance } from "@vue/composition-api";

defineComponent({
  setup() {
    const __currentInstance = getCurrentInstance();

    return () => <MyComponent model={{
      value: a.b,
      callback: $$v => {
        __currentInstance.$set(a, "b", $$v);
      }
    }} />
  }
})
```
