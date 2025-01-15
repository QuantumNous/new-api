const fs = require('fs')
const path = require('path')
const { resolveCompiler } = require('./compiler')

const cache = new Map()

exports.setDescriptor = function setDescriptor(filename, entry) {
  cache.set(cleanQuery(filename), entry)
}

exports.getDescriptor = function getDescriptor(
  filename,
  options,
  loaderContext
) {
  filename = cleanQuery(filename)
  if (cache.has(filename)) {
    return cache.get(filename)
  }

  // This function should only be called after the descriptor has been
  // cached by the main loader.
  // If this is somehow called without a cache hit, it's probably due to sub
  // loaders being run in separate threads. The only way to deal with this is to
  // read from disk directly...
  const source = fs.readFileSync(filename, 'utf-8')
  const sourceRoot = path.dirname(
    path.relative(loaderContext.rootContext, loaderContext.resourcePath)
  )
  const { compiler, templateCompiler } = resolveCompiler(
    loaderContext.rootContext
  )
  const descriptor = compiler.parse({
    source,
    compiler: options.compiler || templateCompiler,
    filename,
    sourceRoot,
    needMap: loaderContext.sourceMap
  })
  cache.set(filename, descriptor)
  return descriptor
}

function cleanQuery(str) {
  const i = str.indexOf('?')
  return i > 0 ? str.slice(0, i) : str
}
