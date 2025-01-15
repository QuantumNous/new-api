# vue-hot-reload-api

> Note: `vue-hot-reload-api@2.x` only works with `vue@2.x`

Hot reload API for Vue components. This is what [vue-loader](https://github.com/vuejs/vue-loader) and [vueify](https://github.com/vuejs/vueify) use under the hood.

## Usage

You will only be using this if you are writing some build toolchain based on Vue components. For normal application usage, just use `vue-loader` or `vueify`.

``` js
// define a component as an options object
const myComponentOptions = {
  data () { ... },
  created () { ... },
  render () { ... }
}

// assuming Webpack's HMR API.
// https://webpack.js.org/guides/hot-module-replacement/
if (module.hot) {
  const api = require('vue-hot-reload-api')
  const Vue = require('vue')

  // make the API aware of the Vue that you are using.
  // also checks compatibility.
  api.install(Vue)

  // compatibility can be checked via api.compatible after installation
  if (!api.compatible) {
    throw new Error('vue-hot-reload-api is not compatible with the version of Vue you are using.')
  }

  // indicate this module can be hot-reloaded
  module.hot.accept()

  if (!module.hot.data) {
    // for each component option object to be hot-reloaded,
    // you need to create a record for it with a unique id.
    // do this once on startup.
    api.createRecord('very-unique-id', myComponentOptions)
  } else {
    // if a component has only its template or render function changed,
    // you can force a re-render for all its active instances without
    // destroying/re-creating them. This keeps all current app state intact.
    api.rerender('very-unique-id', myComponentOptions)

    // --- OR ---

    // if a component has non-template/render options changed,
    // it needs to be fully reloaded. This will destroy and re-create all its
    // active instances (and their children).
    api.reload('very-unique-id', myComponentOptions)
  }
}
```

## License

[MIT](http://opensource.org/licenses/MIT)
