## @vue/babel-sugar-composition-api-inject-h

> Ported from [luwanquan/babel-preset-vca-jsx](https://github.com/luwanquan/babel-preset-vca-jsx) by [@luwanquan](https://github.com/luwanquan)

Syntactic sugar for automatic `h` inject in JSX with @vue/composition-api.

### Babel Compatibility Notes

- This repo is only compatible with Babel 7.x

### Usage

Install the dependencies:

```sh
# for yarn:
yarn add @vue/babel-sugar-composition-api-inject-h
# for npm:
npm install @vue/babel-sugar-composition-api-inject-h --save
```

In your `.babelrc`:

```json
{
  "plugins": ["@vue/babel-sugar-composition-api-inject-h"]
}
```

However it is recommended to use the [configurable preset](../babel-preset-jsx/README.md) instead.

### Details

This plugin automatically injects `h` in every method that has JSX. By using this plugin you don't have to always import `h` from `@vue/composition-api`.

```js
// Without @vue/babel-sugar-inject-h
import { h } from '@vue/composition-api'

export default {
  setup() {
    return () => <button />
  },
}
```

```js
// With @vue/babel-sugar-inject-h
export default {
  setup() {
    return () => <button />
  },
}
```
