> A Next.js extension for Semi Design.

Because Next.js does not support the global introduction of css in third-party code, but semi does. In order to support Next.js, it is necessary to exclude the css reference in the semi code at compile time.

## Installation 
Install `@douyinfe/semi-next` as a development dependency:

``` shell
npm install --save-dev @douyinfe/semi-next
# or
yarn add --dev @douyinfe/semi-next
```

## Usage

Create a `next.config.js` in your project.

``` js
// next.config.js

const semi = require('@douyinfe/semi-next').default({/* the extension options */});
module.exports = semi({
    // your custom Next.js configuration
});
```

## Options

### options.omitCss

Type: `Boolean`

Default: `true`

In the compilation phase, whether to exclude css references.Used to solve the problem that Next.js does not support the global introduction of css in third-party code.See this [discussion](https://github.com/vercel/next.js/discussions/27953).