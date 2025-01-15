import { Plugin } from 'webpack'
import { VueTemplateCompiler } from '@vue/component-compiler-utils/dist/types'
import { CompilerOptions } from 'vue-template-compiler'

declare namespace VueLoader {
  class VueLoaderPlugin extends Plugin {}

  interface VueLoaderOptions {
    transformAssetUrls?: { [tag: string]: string | Array<string> }
    compiler?: VueTemplateCompiler
    compilerOptions?: CompilerOptions
    transpileOptions?: Object
    optimizeSSR?: boolean
    hotReload?: boolean
    productionMode?: boolean
    shadowMode?: boolean
    cacheDirectory?: string
    cacheIdentifier?: string
    prettify?: boolean
    exposeFilename?: boolean
    experimentalInlineMatchResource?: boolean
  }
}

export = VueLoader
