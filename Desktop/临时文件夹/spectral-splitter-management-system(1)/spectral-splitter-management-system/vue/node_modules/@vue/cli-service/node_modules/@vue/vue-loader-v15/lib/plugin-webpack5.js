const { resolveCompiler } = require('./compiler')

const qs = require('querystring')
const id = 'vue-loader-plugin'
const NS = 'vue-loader'
const BasicEffectRulePlugin = require('webpack/lib/rules/BasicEffectRulePlugin')
const BasicMatcherRulePlugin = require('webpack/lib/rules/BasicMatcherRulePlugin')
const RuleSetCompiler = require('webpack/lib/rules/RuleSetCompiler')
const UseEffectRulePlugin = require('webpack/lib/rules/UseEffectRulePlugin')

const objectMatcherRulePlugins = []
try {
  const ObjectMatcherRulePlugin = require('webpack/lib/rules/ObjectMatcherRulePlugin')
  objectMatcherRulePlugins.push(
    new ObjectMatcherRulePlugin('assert', 'assertions'),
    new ObjectMatcherRulePlugin('descriptionData')
  )
} catch (e) {
  const DescriptionDataMatcherRulePlugin = require('webpack/lib/rules/DescriptionDataMatcherRulePlugin')
  objectMatcherRulePlugins.push(new DescriptionDataMatcherRulePlugin())
}

const ruleSetCompiler = new RuleSetCompiler([
  new BasicMatcherRulePlugin('test', 'resource'),
  new BasicMatcherRulePlugin('mimetype'),
  new BasicMatcherRulePlugin('dependency'),
  new BasicMatcherRulePlugin('include', 'resource'),
  new BasicMatcherRulePlugin('exclude', 'resource', true),
  new BasicMatcherRulePlugin('conditions'),
  new BasicMatcherRulePlugin('resource'),
  new BasicMatcherRulePlugin('resourceQuery'),
  new BasicMatcherRulePlugin('resourceFragment'),
  new BasicMatcherRulePlugin('realResource'),
  new BasicMatcherRulePlugin('issuer'),
  new BasicMatcherRulePlugin('compiler'),
  ...objectMatcherRulePlugins,
  new BasicEffectRulePlugin('type'),
  new BasicEffectRulePlugin('sideEffects'),
  new BasicEffectRulePlugin('parser'),
  new BasicEffectRulePlugin('resolve'),
  new BasicEffectRulePlugin('generator'),
  new UseEffectRulePlugin()
])

class VueLoaderPlugin {
  apply(compiler) {
    const normalModule = compiler.webpack
      ? compiler.webpack.NormalModule
      : require('webpack/lib/NormalModule')
    // add NS marker so that the loader can detect and report missing plugin
    compiler.hooks.compilation.tap(id, (compilation) => {
      const normalModuleLoader =
        normalModule.getCompilationHooks(compilation).loader
      normalModuleLoader.tap(id, (loaderContext) => {
        loaderContext[NS] = true
      })
    })

    const rules = compiler.options.module.rules
    let rawVueRule
    let vueRules = []

    for (const rawRule of rules) {
      // skip rules with 'enforce'. eg. rule for eslint-loader
      if (rawRule.enforce) {
        continue
      }
      vueRules = match(rawRule, 'foo.vue')
      if (!vueRules.length) {
        vueRules = match(rawRule, 'foo.vue.html')
      }
      if (vueRules.length > 0) {
        if (rawRule.oneOf) {
          throw new Error(
            `[VueLoaderPlugin Error] vue-loader 15 currently does not support vue rules with oneOf.`
          )
        }
        rawVueRule = rawRule
        break
      }
    }
    if (!vueRules.length) {
      throw new Error(
        `[VueLoaderPlugin Error] No matching rule for .vue files found.\n` +
          `Make sure there is at least one root-level rule that matches .vue or .vue.html files.`
      )
    }

    // get the normalized "use" for vue files
    const vueUse = vueRules
      .filter((rule) => rule.type === 'use')
      .map((rule) => rule.value)

    // get vue-loader options
    const vueLoaderUseIndex = vueUse.findIndex((u) => {
      return /^vue-loader|(\/|\\|@)vue-loader/.test(u.loader)
    })

    if (vueLoaderUseIndex < 0) {
      throw new Error(
        `[VueLoaderPlugin Error] No matching use for vue-loader is found.\n` +
          `Make sure the rule matching .vue files include vue-loader in its use.`
      )
    }

    // make sure vue-loader options has a known ident so that we can share
    // options by reference in the template-loader by using a ref query like
    // template-loader??vue-loader-options
    const vueLoaderUse = vueUse[vueLoaderUseIndex]
    vueLoaderUse.ident = 'vue-loader-options'
    vueLoaderUse.options = vueLoaderUse.options || {}
    const enableInlineMatchResource =
      vueLoaderUse.options.experimentalInlineMatchResource

    // for each user rule (expect the vue rule), create a cloned rule
    // that targets the corresponding language blocks in *.vue files.
    const refs = new Map()
    const clonedRules = rules
      .filter((r) => r !== rawVueRule)
      .map((rawRule) =>
        cloneRule(rawRule, refs, langBlockRuleCheck, langBlockRuleResource)
      )

    // fix conflict with config.loader and config.options when using config.use
    delete rawVueRule.loader
    delete rawVueRule.options
    rawVueRule.use = vueUse

    // rule for template compiler
    const templateCompilerRule = {
      loader: require.resolve('./loaders/templateLoader'),
      resourceQuery: (query) => {
        if (!query) {
          return false
        }
        const parsed = qs.parse(query.slice(1))
        return parsed.vue != null && parsed.type === 'template'
      },
      options: vueLoaderUse.options
    }

    // for each rule that matches plain .js files, also create a clone and
    // match it against the compiled template code inside *.vue files, so that
    // compiled vue render functions receive the same treatment as user code
    // (mostly babel)
    const { is27 } = resolveCompiler(compiler.options.context)
    let jsRulesForRenderFn = []
    if (is27) {
      const skipThreadLoader = true
      jsRulesForRenderFn = rules
        .filter(
          (r) =>
            r !== rawVueRule &&
            (match(r, 'test.js').length > 0 || match(r, 'test.ts').length > 0)
        )
        .map((rawRule) => cloneRule(rawRule, refs, jsRuleCheck, jsRuleResource, skipThreadLoader))
    }

    // global pitcher (responsible for injecting template compiler loader & CSS
    // post loader)
    const pitcher = {
      loader: require.resolve('./loaders/pitcher'),
      resourceQuery: (query) => {
        if (!query) {
          return false
        }
        const parsed = qs.parse(query.slice(1))
        return parsed.vue != null
      },
      options: vueLoaderUse.options
    }
    // replace original rules
    if (enableInlineMatchResource) {
      // Match rules using `vue-loader`
      const vueLoaderRules = rules.filter((rule) => {
        const matchOnce = (use) => {
          let loaderString = ''

          if (!use) {
            return loaderString
          }

          if (typeof use === 'string') {
            loaderString = use
          } else if (Array.isArray(use)) {
            loaderString = matchOnce(use[0])
          } else if (typeof use === 'object' && use.loader) {
            loaderString = use.loader
          }
          return loaderString
        }

        const loader = rule.loader || matchOnce(rule.use)
        return (
          loader === require('../package.json').name ||
          loader.startsWith(require.resolve('./index'))
        )
      })

      compiler.options.module.rules = [
        pitcher,
        ...rules.filter((rule) => !vueLoaderRules.includes(rule)),
        ...(is27 ? [templateCompilerRule] : []),
        ...clonedRules,
        ...vueLoaderRules
      ]
    } else {
      compiler.options.module.rules = [
        pitcher,
        ...jsRulesForRenderFn,
        ...(is27 ? [templateCompilerRule] : []),
        ...clonedRules,
        ...rules
      ]
    }
  }
}

const matcherCache = new WeakMap()

function match(rule, fakeFile) {
  let ruleSet = matcherCache.get(rule)
  if (!ruleSet) {
    // skip the `include` check when locating the vue rule
    const clonedRawRule = { ...rule }
    delete clonedRawRule.include

    ruleSet = ruleSetCompiler.compile([clonedRawRule])
    matcherCache.set(rule, ruleSet)
  }

  return ruleSet.exec({
    resource: fakeFile
  })
}

const langBlockRuleCheck = (query, rule) => {
  return (
    query.type === 'custom' || !rule.conditions.length || query.lang != null
  )
}

const langBlockRuleResource = (query, resource) => `${resource}.${query.lang}`

const jsRuleCheck = (query) => {
  return query.type === 'template'
}

const jsRuleResource = (query, resource) =>
  `${resource}.${query.ts ? `ts` : `js`}`

let uid = 0

function cloneRule(rawRule, refs, ruleCheck, ruleResource, skipThreadLoader) {
  const compiledRule = ruleSetCompiler.compileRule(
    `clonedRuleSet-${++uid}`,
    rawRule,
    refs
  )

  // do not process rule with enforce
  if (!rawRule.enforce) {
    const ruleUse = compiledRule.effects
      .filter((effect) => effect.type === 'use')
      .map((effect) => effect.value)
    // fix conflict with config.loader and config.options when using config.use
    delete rawRule.loader
    delete rawRule.options

    // Filter out `thread-loader` from the `use` array.
    // Mitigate https://github.com/vuejs/vue/issues/12828
    // Note this won't work if the `use` filed is a function
    if (skipThreadLoader && Array.isArray(ruleUse)) {
      const isThreadLoader = (loader) => loader === 'thread-loader' || /\/node_modules\/thread-loader\//.test(loader)
      rawRule.use = ruleUse.filter(useEntry => {
        const loader = typeof useEntry === 'string' ? useEntry : useEntry.loader
        return !isThreadLoader(loader)
      })
    } else {
      rawRule.use = ruleUse
    }
  }

  let currentResource
  const res = {
    ...rawRule,
    resource: (resources) => {
      currentResource = resources
      return true
    },
    resourceQuery: (query) => {
      if (!query) {
        return false
      }

      const parsed = qs.parse(query.slice(1))
      if (parsed.vue == null) {
        return false
      }
      if (!ruleCheck(parsed, compiledRule)) {
        return false
      }
      const fakeResourcePath = ruleResource(parsed, currentResource)
      for (const condition of compiledRule.conditions) {
        // add support for resourceQuery
        const request =
          condition.property === 'resourceQuery' ? query : fakeResourcePath
        if (condition && !condition.fn(request)) {
          return false
        }
      }
      return true
    }
  }

  delete res.test

  if (rawRule.rules) {
    res.rules = rawRule.rules.map((rule) =>
      cloneRule(rule, refs, ruleCheck, ruleResource)
    )
  }

  if (rawRule.oneOf) {
    res.oneOf = rawRule.oneOf.map((rule) =>
      cloneRule(rule, refs, ruleCheck, ruleResource)
    )
  }

  return res
}

VueLoaderPlugin.NS = NS
module.exports = VueLoaderPlugin
