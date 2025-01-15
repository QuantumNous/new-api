# @vue/component-compiler-utils [![Build Status](https://circleci.com/gh/vuejs/component-compiler-utils/tree/master.svg?style=shield)](https://circleci.com/gh/vuejs/component-compiler-utils/)

> Lower level utilities for compiling Vue single file components

This package contains lower level utilities that you can use if you are writing a plugin / transform for a bundler or module system that compiles Vue single file components into JavaScript. It is used in [vue-loader](https://github.com/vuejs/vue-loader) version 15 and above.

The API surface is intentionally minimal - the goal is to reuse as much as possible while being as flexible as possible.

## Why isn't `vue-template-compiler` a peerDependency?

Since this package is more often used as a low-level utility, it is usually a transitive dependency in an actual Vue project. It is therefore the responsibility of the higher-level package (e.g. `vue-loader`) to inject `vue-template-compiler` via options when calling the `parse` and `compileTemplate` methods.

Not listing it as a peer depedency also allows tooling authors to use a non-default template compiler instead of `vue-template-compiler` without having to include it just to fullfil the peer dep requirement.

## API

### parse(ParseOptions): SFCDescriptor

Parse raw single file component source into a descriptor with source maps. The actual compiler (`vue-template-compiler`) must be passed in via the `compiler` option so that the specific version used can be determined by the end user.

``` ts
interface ParseOptions {
  source: string
  filename?: string
  compiler: VueTemplateCompiler
  // https://github.com/vuejs/vue/tree/dev/packages/vue-template-compiler#compilerparsecomponentfile-options
  // default: { pad: 'line' }
  compilerParseOptions?: VueTemplateCompilerParseOptions
  sourceRoot?: string
  needMap?: boolean
}

interface SFCDescriptor {
  template: SFCBlock | null
  script: SFCBlock | null
  styles: SFCBlock[]
  customBlocks: SFCCustomBlock[]
}

interface SFCCustomBlock {
  type: string
  content: string
  attrs: { [key: string]: string | true }
  start: number
  end: number
  map?: RawSourceMap
}

interface SFCBlock extends SFCCustomBlock {
  lang?: string
  src?: string
  scoped?: boolean
  module?: string | boolean
}
```

### compileTemplate(TemplateCompileOptions): TemplateCompileResults

Takes raw template source and compile it into JavaScript code. The actual compiler (`vue-template-compiler`) must be passed in via the `compiler` option so that the specific version used can be determined by the end user.

It can also optionally perform pre-processing for any templating engine supported by [consolidate](https://github.com/tj/consolidate.js/).

``` ts
interface TemplateCompileOptions {
  source: string
  filename: string

  compiler: VueTemplateCompiler
  // https://github.com/vuejs/vue/tree/dev/packages/vue-template-compiler#compilercompiletemplate-options
  // default: {}
  compilerOptions?: VueTemplateCompilerOptions

  // Template preprocessor
  preprocessLang?: string
  preprocessOptions?: any

  // Transform asset urls found in the template into `require()` calls
  // This is off by default. If set to true, the default value is
  // {
  //   audio: 'src',
  //   video: ['src', 'poster'],
  //   source: 'src',
  //   img: 'src',
  //   image: ['xlink:href', 'href'],
  //   use: ['xlink:href', 'href']
  // }
  transformAssetUrls?: AssetURLOptions | boolean

  // For vue-template-es2015-compiler, which is a fork of Buble
  transpileOptions?: any

  isProduction?: boolean  // default: false
  isFunctional?: boolean  // default: false
  optimizeSSR?: boolean   // default: false

  // Whether prettify compiled render function or not (development only)
  // default: true
  prettify?: boolean
}

interface TemplateCompileResult {
  ast: Object | undefined
  code: string
  source: string
  tips: string[]
  errors: string[]
}

interface AssetURLOptions {
  [name: string]: string | string[]
}
```

#### Handling the Output

The resulting JavaScript code will look like this:

``` js
var render = function (h) { /* ... */}
var staticRenderFns = [function (h) { /* ... */}, function (h) { /* ... */}]
```

It **does NOT** assume any module system. It is your responsibility to handle the exports, if needed.

### compileStyle(StyleCompileOptions)

Take input raw CSS and applies scoped CSS transform. It does NOT handle pre-processors. If the component doesn't use scoped CSS then this step can be skipped.

``` ts
interface StyleCompileOptions {
  source: string
  filename: string
  id: string
  map?: any
  scoped?: boolean
  trim?: boolean
  preprocessLang?: string
  preprocessOptions?: any
  postcssOptions?: any
  postcssPlugins?: any[]
}

interface StyleCompileResults {
  code: string
  map: any | void
  rawResult: LazyResult | void // raw lazy result from PostCSS
  errors: string[]
}
```

### compileStyleAsync(StyleCompileOptions)

Same as `compileStyle(StyleCompileOptions)` but it returns a Promise resolving to `StyleCompileResults`. It can be used with async postcss plugins.
