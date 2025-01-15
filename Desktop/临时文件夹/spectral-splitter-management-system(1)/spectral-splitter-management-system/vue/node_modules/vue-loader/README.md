# vue-loader [![ci](https://github.com/vuejs/vue-loader/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vuejs/vue-loader/actions/workflows/ci.yml)

> webpack loader for Vue Single-File Components

- [Documentation](https://vue-loader.vuejs.org)

## v17.2.1+ Only Options

- `experimentalInlineMatchResource: boolean`: enable [Inline matchResource](https://webpack.js.org/api/loaders/#inline-matchresource) for rule matching for vue-loader.

## v16+ Only Options

- `reactivityTransform: boolean`: enable [Vue Reactivity Transform](https://github.com/vuejs/rfcs/discussions/369) (SFCs only).

- ~~`refSugar: boolean`: **removed.** use `reactivityTransform` instead.~~

- `customElement: boolean | RegExp`: enable custom elements mode. An SFC loaded in custom elements mode inlines its `<style>` tags as strings under the component's `styles` option. When used with `defineCustomElement` from Vue core, the styles will be injected into the custom element's shadow root.

  - Default is `/\.ce\.vue$/`
  - Setting to `true` will process all `.vue` files in custom element mode.

- `enableTsInTemplate: boolean` (16.8+): allow TS expressions in templates when `<script>` has `lang="ts"`. Defaults to `true`.

  - When used with `ts-loader`, due to `ts-loader`'s cache invalidation behavior, it sometimes prevents the template from being hot-reloaded in isolation, causing the component to reload despite only the template being edited. If this is annoying, you can set this option to `false` (and avoid using TS expressions in templates).

  - Alternatively, leave this option on (by default) and use [`esbuild-loader`](https://github.com/privatenumber/esbuild-loader) to transpile TS instead, which doesn't suffer from this problem (it's also a lot faster). However, do note you will need to rely on TS type checking from other sources (e.g. IDE or `vue-tsc`).

## What is Vue Loader?

`vue-loader` is a loader for [webpack](https://webpack.js.org/) that allows you to author Vue components in a format called [Single-File Components (SFCs)](./docs/spec.md):

```vue
<template>
  <div class="example">{{ msg }}</div>
</template>

<script>
export default {
  data() {
    return {
      msg: 'Hello world!',
    }
  },
}
</script>

<style>
.example {
  color: red;
}
</style>
```

There are many cool features provided by `vue-loader`:

- Allows using other webpack loaders for each part of a Vue component, for example Sass for `<style>` and Pug for `<template>`;
- Allows custom blocks in a `.vue` file that can have custom loader chains applied to them;
- Treat static assets referenced in `<style>` and `<template>` as module dependencies and handle them with webpack loaders;
- Simulate scoped CSS for each component;
- State-preserving hot-reloading during development.

In a nutshell, the combination of webpack and `vue-loader` gives you a modern, flexible and extremely powerful front-end workflow for authoring Vue.js applications.

## How It Works

> The following section is for maintainers and contributors who are interested in the internal implementation details of `vue-loader`, and is **not** required knowledge for end users.

`vue-loader` is not a simple source transform loader. It handles each language blocks inside an SFC with its own dedicated loader chain (you can think of each block as a "virtual module"), and finally assembles the blocks together into the final module. Here's a brief overview of how the whole thing works:

1. `vue-loader` parses the SFC source code into an _SFC Descriptor_ using `@vue/compiler-sfc`. It then generates an import for each language block so the actual returned module code looks like this:

   ```js
   // code returned from the main loader for 'source.vue'

   // import the <template> block
   import render from 'source.vue?vue&type=template'
   // import the <script> block
   import script from 'source.vue?vue&type=script'
   export * from 'source.vue?vue&type=script'
   // import <style> blocks
   import 'source.vue?vue&type=style&index=1'

   script.render = render
   export default script
   ```

   Notice how the code is importing `source.vue` itself, but with different request queries for each block.

2. We want the content in `script` block to be treated like `.js` files (and if it's `<script lang="ts">`, we want to to be treated like `.ts` files). Same for other language blocks. So we want webpack to apply any configured module rules that matches `.js` also to requests that look like `source.vue?vue&type=script`. This is what `VueLoaderPlugin` (`src/plugins.ts`) does: for each module rule in the webpack config, it creates a modified clone that targets corresponding Vue language block requests.

   Suppose we have configured `babel-loader` for all `*.js` files. That rule will be cloned and applied to Vue SFC `<script>` blocks as well. Internally to webpack, a request like

   ```js
   import script from 'source.vue?vue&type=script'
   ```

   Will expand to:

   ```js
   import script from 'babel-loader!vue-loader!source.vue?vue&type=script'
   ```

   Notice the `vue-loader` is also matched because `vue-loader` are applied to `.vue` files.

   Similarly, if you have configured `style-loader` + `css-loader` + `sass-loader` for `*.scss` files:

   ```html
   <style scoped lang="scss">
   ```

   Will be returned by `vue-loader` as:

   ```js
   import 'source.vue?vue&type=style&index=1&scoped&lang=scss'
   ```

   And webpack will expand it to:

   ```js
   import 'style-loader!css-loader!sass-loader!vue-loader!source.vue?vue&type=style&index=1&scoped&lang=scss'
   ```

3. When processing the expanded requests, the main `vue-loader` will get invoked again. This time though, the loader notices that the request has queries and is targeting a specific block only. So it selects (`src/select.ts`) the inner content of the target block and passes it on to the loaders matched after it.

4. For the `<script>` block, this is pretty much it. For `<template>` and `<style>` blocks though, a few extra tasks need to be performed:

   - We need to compile the template using the Vue template compiler;
   - We need to post-process the CSS in `<style scoped>` blocks, **after** `css-loader` but **before** `style-loader`.

   Technically, these are additional loaders (`src/templateLoader.ts` and `src/stylePostLoader.ts`) that need to be injected into the expanded loader chain. It would be very complicated if the end users have to configure this themselves, so `VueLoaderPlugin` also injects a global [Pitching Loader](https://webpack.js.org/api/loaders/#pitching-loader) (`src/pitcher.ts`) that intercepts Vue `<template>` and `<style>` requests and injects the necessary loaders. The final requests look like the following:

   ```js
   // <template lang="pug">
   import 'vue-loader/template-loader!pug-loader!source.vue?vue&type=template'

   // <style scoped lang="scss">
   import 'style-loader!vue-loader/style-post-loader!css-loader!sass-loader!vue-loader!source.vue?vue&type=style&index=1&scoped&lang=scss'
   ```
