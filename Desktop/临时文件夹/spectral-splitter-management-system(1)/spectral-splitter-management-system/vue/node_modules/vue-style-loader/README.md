# vue-style-loader [![Build Status](https://circleci.com/gh/vuejs/vue-style-loader/tree/master.svg?style=shield)](https://circleci.com/gh/vuejs/vue-loader/tree/master) [![npm package](https://img.shields.io/npm/v/vue-style-loader.svg)](https://www.npmjs.com/package/vue-style-loader)

This is a fork based on [style-loader](https://github.com/webpack/style-loader). Similar to `style-loader`, you can chain it after `css-loader` to dynamically inject CSS into the document as style tags. However, since this is included as a dependency and used by default in `vue-loader`, in most cases you don't need to configure this loader yourself.

## Options

- **manualInject** (3.1.0+):

  Type: `boolean`. When importing the style from a non-vue-file, by default the style is injected as a side effect of the import. When `manualInject` is true, the imported style object exposes a `__inject__` method, which can then be called manually at appropriate timing. If called on the server, the method expects one argument which is the `ssrContext` to attach styles to.

  ``` js
  import styles from 'styles.scss'

  export default {
    beforeCreate() { // or create a mixin for this purpose
      if(styles.__inject__) {
        styles.__inject__(this.$ssrContext)
      }
    }

    render() {
      return <div class={styles.heading}>Hello World</div>
    }
  }
  ```

  Note this behavior is enabled automatically when `vue-style-loader` is used on styles imported within a `*.vue` file. The option is only exposed for advanced usage.

- **ssrId** (3.1.0+):

  Type: `boolean`. Add `data-vue-ssr-id` attribute to injected `<style>` tags even when not in Node.js. This can be used with pre-rendering (instead of SSR) to avoid duplicate style injection on hydration.

## Differences from `style-loader`

### Server-Side Rendering Support

When bundling with `target: 'node'`, the styles in all rendered components are collected and exposed on the Vue render context object as `context.styles`, which you can simply inline into your markup's `<head>`. If you are building a Vue SSR app, you probably should use this loader for CSS imported from JavaScript files too.

### Misc

- Does not support url mode and reference counting mode. Also removed `singleton` and `insertAt` query options. It always automatically pick the style insertion mechanism that makes most sense. If you need these capabilities you should probably use the original `style-loader` instead.

- Fixed the issue that root-relative URLs are interpreted against chrome:// urls and make source map URLs work for injected `<style>` tags in Chrome.

## License

MIT
