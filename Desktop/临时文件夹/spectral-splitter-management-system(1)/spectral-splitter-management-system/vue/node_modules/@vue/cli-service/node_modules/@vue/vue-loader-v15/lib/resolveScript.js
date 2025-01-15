const { resolveCompiler } = require('./compiler')

const clientCache = new WeakMap()
const serverCache = new WeakMap()

exports.resolveScript = function resolveScript(
  descriptor,
  scopeId,
  options,
  loaderContext
) {
  if (!descriptor.script && !descriptor.scriptSetup) {
    return null
  }

  const { compiler } = resolveCompiler(loaderContext.rootContext, loaderContext)
  if (!compiler.compileScript) {
    if (descriptor.scriptSetup) {
      loaderContext.emitError(
        'The version of Vue you are using does not support <script setup>. ' +
          'Please upgrade to 2.7 or above.'
      )
    }
    return descriptor.script
  }

  const isProd =
    loaderContext.mode === 'production' || process.env.NODE_ENV === 'production'
  const isServer = options.optimizeSSR || loaderContext.target === 'node'

  const cacheToUse = isServer ? serverCache : clientCache
  const cached = cacheToUse.get(descriptor)
  if (cached) {
    return cached
  }

  let resolved = null

  try {
    resolved = compiler.compileScript(descriptor, {
      id: scopeId,
      isProd,
      babelParserPlugins: options.babelParserPlugins
    })
  } catch (e) {
    loaderContext.emitError(e)
  }

  cacheToUse.set(descriptor, resolved)
  return resolved
}
