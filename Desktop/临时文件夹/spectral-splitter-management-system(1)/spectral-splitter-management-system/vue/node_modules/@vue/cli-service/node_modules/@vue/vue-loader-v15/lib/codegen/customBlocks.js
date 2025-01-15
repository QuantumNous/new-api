const qs = require('querystring')
const { attrsToQuery, genMatchResource } = require('./utils')

module.exports = function genCustomBlocksCode(
  loaderContext,
  blocks,
  resourcePath,
  resourceQuery,
  stringifyRequest,
  enableInlineMatchResource
) {
  return (
    `\n/* custom blocks */\n` +
    blocks
      .map((block, i) => {
        const src = block.attrs.src || resourcePath
        const attrsQuery = attrsToQuery(block.attrs)
        const issuerQuery = block.attrs.src
          ? `&issuerPath=${qs.escape(resourcePath)}`
          : ''
        const inheritQuery = resourceQuery ? `&${resourceQuery.slice(1)}` : ''
        const externalQuery = block.attrs.src ? `&external` : ``
        const query = `?vue&type=custom&index=${i}&blockType=${qs.escape(
          block.type
        )}${issuerQuery}${attrsQuery}${inheritQuery}${externalQuery}`

        let customRequest

        if (enableInlineMatchResource) {
          customRequest = stringifyRequest(
            genMatchResource(loaderContext, src, query, block.attrs.lang)
          )
        } else {
          customRequest = stringifyRequest(src + query)
        }
        return (
          `import block${i} from ${customRequest}\n` +
          `if (typeof block${i} === 'function') block${i}(component)`
        )
      })
      .join(`\n`) +
    `\n`
  )
}
