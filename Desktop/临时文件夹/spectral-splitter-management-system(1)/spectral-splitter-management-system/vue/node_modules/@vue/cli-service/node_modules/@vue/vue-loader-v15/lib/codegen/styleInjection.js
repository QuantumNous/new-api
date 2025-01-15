const { attrsToQuery, genMatchResource } = require('./utils')
const hotReloadAPIPath = JSON.stringify(require.resolve('vue-hot-reload-api'))
const nonWhitespaceRE = /\S+/

module.exports = function genStyleInjectionCode(
  loaderContext,
  styles,
  id,
  resourcePath,
  stringifyRequest,
  needsHotReload,
  needsExplicitInjection,
  isProduction,
  enableInlineMatchResource
) {
  let styleImportsCode = ``
  let styleInjectionCode = ``
  let cssModulesHotReloadCode = ``

  let hasCSSModules = false
  const cssModuleNames = new Map()

  function genStyleRequest(style, i) {
    const src = style.src || resourcePath
    const attrsQuery = attrsToQuery(style.attrs, 'css')
    const lang = String(style.attrs.lang || 'css')
    const inheritQuery = loaderContext.resourceQuery.slice(1)
      ? `&${loaderContext.resourceQuery.slice(1)}`
      : ''
    // make sure to only pass id not src importing so that we don't inject
    // duplicate tags when multiple components import the same css file
    const idQuery = !style.src || style.scoped ? `&id=${id}` : ``
    const prodQuery = isProduction ? `&prod` : ``
    const externalQuery = style.src ? `&external` : ``
    const query = `?vue&type=style&index=${i}${idQuery}${prodQuery}${attrsQuery}${inheritQuery}${externalQuery}`
    let styleRequest
    if (enableInlineMatchResource) {
      styleRequest = stringifyRequest(genMatchResource(loaderContext, src, query, lang))
    } else {
      styleRequest = stringifyRequest(src + query)
    }
    return styleRequest
  }

  function genCSSModulesCode(style, request, i) {
    hasCSSModules = true

    const moduleName = style.module === true ? '$style' : style.module
    if (cssModuleNames.has(moduleName)) {
      loaderContext.emitError(`CSS module name ${moduleName} is not unique!`)
    }
    cssModuleNames.set(moduleName, true)

    // `(vue-)style-loader` exports the name-to-hash map directly
    // `css-loader` exports it in `.locals`
    const locals = `(style${i}.locals || style${i})`
    const name = JSON.stringify(moduleName)

    if (!needsHotReload) {
      styleInjectionCode += `this[${name}] = ${locals}\n`
    } else {
      styleInjectionCode += `
        cssModules[${name}] = ${locals}
        Object.defineProperty(this, ${name}, {
          configurable: true,
          get: function () {
            return cssModules[${name}]
          }
        })
      `
      cssModulesHotReloadCode += `
        module.hot && module.hot.accept([${request}], function () {
          var oldLocals = cssModules[${name}]
          if (oldLocals) {
            var newLocals = require(${request})
            if (JSON.stringify(newLocals) !== JSON.stringify(oldLocals)) {
              cssModules[${name}] = newLocals
              require(${hotReloadAPIPath}).rerender("${id}")
            }
          }
        })
      `
    }
  }

  // empty styles: with no `src` specified or only contains whitespaces
  const isNotEmptyStyle = (style) =>
    style.src || nonWhitespaceRE.test(style.content)
  // explicit injection is needed in SSR (for critical CSS collection)
  // or in Shadow Mode (for injection into shadow root)
  // In these modes, vue-style-loader exports objects with the __inject__
  // method; otherwise we simply import the styles.
  if (!needsExplicitInjection) {
    styles.forEach((style, i) => {
      // do not generate requests for empty styles
      if (isNotEmptyStyle(style)) {
        const request = genStyleRequest(style, i)
        styleImportsCode += `import style${i} from ${request}\n`
        if (style.module) genCSSModulesCode(style, request, i)
      }
    })
  } else {
    styles.forEach((style, i) => {
      if (isNotEmptyStyle(style)) {
        const request = genStyleRequest(style, i)
        styleInjectionCode +=
          `var style${i} = require(${request})\n` +
          `if (style${i}.__inject__) style${i}.__inject__(context)\n`
        if (style.module) genCSSModulesCode(style, request, i)
      }
    })
  }

  if (!needsExplicitInjection && !hasCSSModules) {
    return styleImportsCode
  }

  return `
${styleImportsCode}
${hasCSSModules && needsHotReload ? `var cssModules = {}` : ``}
${needsHotReload ? `var disposed = false` : ``}

function injectStyles (context) {
  ${needsHotReload ? `if (disposed) return` : ``}
  ${styleInjectionCode}
}

${
  needsHotReload
    ? `
  module.hot && module.hot.dispose(function (data) {
    disposed = true
  })
`
    : ``
}

${cssModulesHotReloadCode}
  `.trim()
}
