const qs = require('querystring')

// these are built-in query parameters so should be ignored
// if the user happen to add them as attrs
const ignoreList = ['id', 'index', 'src', 'type']

// transform the attrs on a SFC block descriptor into a resourceQuery string
exports.attrsToQuery = (attrs, langFallback) => {
  let query = ``
  for (const name in attrs) {
    const value = attrs[name]
    if (!ignoreList.includes(name)) {
      query += `&${qs.escape(name)}=${value ? qs.escape(value) : ``}`
    }
  }
  if (langFallback && !(`lang` in attrs)) {
    query += `&lang=${langFallback}`
  }
  return query
}

exports.genMatchResource = (context, resourcePath, resourceQuery, lang) => {
  resourceQuery = resourceQuery || ''

  const loaders = []
  const parsedQuery = qs.parse(resourceQuery.slice(1))

  // process non-external resources
  if ('vue' in parsedQuery && !('external' in parsedQuery)) {
    const currentRequest = context.loaders
      .slice(context.loaderIndex)
      .map((obj) => obj.request)
    loaders.push(...currentRequest)
  }
  const loaderString = loaders.join('!')

  return `${resourcePath}${lang ? `.${lang}` : ''}${resourceQuery}!=!${
    loaderString ? `${loaderString}!` : ''
  }${resourcePath}${resourceQuery}`
}

exports.testWebpack5 = (compiler) => {
  if (!compiler) {
    return false
  }
  const webpackVersion = compiler.webpack && compiler.webpack.version
  return Boolean(webpackVersion && Number(webpackVersion.split('.')[0]) > 4)
}
