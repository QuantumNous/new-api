# Babel Plugin JSX for Vue 3

[![npm package](https://img.shields.io/npm/v/@vue/babel-plugin-jsx.svg?style=flat-square)](https://www.npmjs.com/package/@vue/babel-plugin-jsx)
[![issues-helper](https://img.shields.io/badge/Issues%20Manage%20By-issues--helper-blueviolet?style=flat-square)](https://github.com/actions-cool/issues-helper)

To add Vue JSX support.

English | [简体中文](/packages/babel-plugin-jsx/README-zh_CN.md)

## Installation

Install the plugin with:

```bash
npm install @vue/babel-plugin-jsx -D
```

Then add the plugin to your babel config:

```json
{
  "plugins": ["@vue/babel-plugin-jsx"]
}
```

## Usage

### options

#### transformOn

Type: `boolean`

Default: `false`

transform `on: { click: xx }` to `onClick: xxx`

#### optimize

Type: `boolean`

Default: `false`

enable optimization or not. It's not recommended to enable it If you are not familiar with Vue 3.

#### isCustomElement

Type: `(tag: string) => boolean`

Default: `undefined`

configuring custom elements

#### mergeProps

Type: `boolean`

Default: `true`

merge static and dynamic class / style attributes / onXXX handlers

#### enableObjectSlots

Type: `boolean`

Default: `true`

Whether to enable `object slots` (mentioned below the document) syntax". It might be useful in JSX, but it will add a lot of `_isSlot` condition expressions which increase your bundle size. And `v-slots` is still available even if `enableObjectSlots` is turned off.

#### pragma

Type: `string`

Default: `createVNode`

Replace the function used when compiling JSX expressions.

## Syntax

### Content

functional component

```jsx
const App = () => <div>Vue 3.0</div>;
```

with render

```jsx
const App = {
  render() {
    return <div>Vue 3.0</div>;
  },
};
```

```jsx
import { withModifiers, defineComponent } from 'vue';

const App = defineComponent({
  setup() {
    const count = ref(0);

    const inc = () => {
      count.value++;
    };

    return () => (
      <div onClick={withModifiers(inc, ['self'])}>{count.value}</div>
    );
  },
});
```

Fragment

```jsx
const App = () => (
  <>
    <span>I'm</span>
    <span>Fragment</span>
  </>
);
```

### Attributes / Props

```jsx
const App = () => <input type="email" />;
```

with a dynamic binding:

```jsx
const placeholderText = 'email';
const App = () => <input type="email" placeholder={placeholderText} />;
```

### Directives

#### v-show

```jsx
const App = {
  data() {
    return { visible: true };
  },
  render() {
    return <input v-show={this.visible} />;
  },
};
```

#### v-model

> Note: You should pass the second param as string for using `arg`.

```jsx
<input v-model={val} />
```

```jsx
<input v-model:argument={val} />
```

```jsx
<input v-model={[val, ['modifier']]} />
```

```jsx
<A v-model={[val, 'argument', ['modifier']]} />
```

Will compile to:

```js
h(A, {
  argument: val,
  argumentModifiers: {
    modifier: true,
  },
  'onUpdate:argument': ($event) => (val = $event),
});
```

#### v-models (Not recommended since v1.1.0)

> Note: You should pass a Two-dimensional Arrays to v-models.

```jsx
<A v-models={[[foo], [bar, 'bar']]} />
```

```jsx
<A
  v-models={[
    [foo, 'foo'],
    [bar, 'bar'],
  ]}
/>
```

```jsx
<A
  v-models={[
    [foo, ['modifier']],
    [bar, 'bar', ['modifier']],
  ]}
/>
```

Will compile to:

```js
h(A, {
  modelValue: foo,
  modelModifiers: {
    modifier: true,
  },
  'onUpdate:modelValue': ($event) => (foo = $event),
  bar: bar,
  barModifiers: {
    modifier: true,
  },
  'onUpdate:bar': ($event) => (bar = $event),
});
```

#### custom directive

Recommended when using string arguments

```jsx
const App = {
  directives: { custom: customDirective },
  setup() {
    return () => <a v-custom:arg={val} />;
  },
};
```

```jsx
const App = {
  directives: { custom: customDirective },
  setup() {
    return () => <a v-custom={[val, 'arg', ['a', 'b']]} />;
  },
};
```

### Slot

> Note: In `jsx`, _`v-slot`_ should be replaced with **`v-slots`**

```jsx
const A = (props, { slots }) => (
  <>
    <h1>{slots.default ? slots.default() : 'foo'}</h1>
    <h2>{slots.bar?.()}</h2>
  </>
);

const App = {
  setup() {
    const slots = {
      bar: () => <span>B</span>,
    };
    return () => (
      <A v-slots={slots}>
        <div>A</div>
      </A>
    );
  },
};

// or

const App = {
  setup() {
    const slots = {
      default: () => <div>A</div>,
      bar: () => <span>B</span>,
    };
    return () => <A v-slots={slots} />;
  },
};

// or you can use object slots when `enableObjectSlots` is not false.
const App = {
  setup() {
    return () => (
      <>
        <A>
          {{
            default: () => <div>A</div>,
            bar: () => <span>B</span>,
          }}
        </A>
        <B>{() => 'foo'}</B>
      </>
    );
  },
};
```

### In TypeScript

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

## Who is using

<table>
  <tbody>
    <tr>
      <td align="center">
        <a target="_blank" href="https://www.antdv.com/">
          <img
            width="32"
            src="https://qn.antdv.com/logo.png"
          />
          <br>
          <strong>Ant Design Vue</strong>
        </a>
      </td>
      <td align="center">
        <a target="_blank" href="https://youzan.github.io/vant/#/zh-CN/">
          <img
            width="32"
            style="vertical-align: -0.32em; margin-right: 8px;"
            src="https://img.yzcdn.cn/vant/logo.png"
          />
          <br>
          <strong>Vant</strong>
        </a>
      </td>
      <td align="center">
        <a target="_blank" href="https://github.com/element-plus/element-plus">
          <img
            height="32"
            style="vertical-align: -0.32em; margin-right: 8px;"
            src="https://user-images.githubusercontent.com/10731096/91267529-259f3680-e7a6-11ea-9a60-3286f750de01.png"
          />
          <br>
          <strong>Element Plus</strong>
        </a>
      </td>
      <td align="center">
        <a target="_blank" href="https://github.com/leezng/vue-json-pretty">
          <img
            height="32"
            style="vertical-align: -0.32em; margin-right: 8px;"
            src="https://raw.githubusercontent.com/leezng/vue-json-pretty/master/static/logo.svg"
          />
          <br>
          <strong>Vue Json Pretty</strong>
        </a>
      </td>
    </tr>
  </tbody>
</table>

## Compatibility

This repo is only compatible with:

- **Babel 7+**
- **Vue 3+**
