const { resolveScript } = require('./resolveScript')

module.exports = function selectBlock(
  descriptor,
  scopeId,
  options,
  loaderContext,
  query,
  appendExtension
) {
  // template
  if (query.type === `template`) {
    if (appendExtension) {
      loaderContext.resourcePath += '.' + (descriptor.template.lang || 'html')
    }
    loaderContext.callback(
      null,
      descriptor.template.content,
      descriptor.template.map
    )
    return
  }

  // script
  if (query.type === `script`) {
    const script = resolveScript(descriptor, scopeId, options, loaderContext)
    if (appendExtension) {
      loaderContext.resourcePath += '.' + (script.lang || 'js')
    }
    loaderContext.callback(null, script.content, script.map)
    return
  }

  // styles
  if (query.type === `style` && query.index != null) {
    const style = descriptor.styles[query.index]
    if (appendExtension) {
      loaderContext.resourcePath += '.' + (style.lang || 'css')
    }
    loaderContext.callback(null, style.content, style.map)
    return
  }

  // custom
  if (query.type === 'custom' && query.index != null) {
    const block = descriptor.customBlocks[query.index]
    loaderContext.callback(null, block.content, block.map)
    return
  }
}
