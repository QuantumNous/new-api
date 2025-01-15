// @ts-check
const { warn } = require('./logger')

/** @typedef {{after?: string|Array<string>}} Apply */
/** @typedef {{id: string, apply: Apply}} Plugin */
/** @typedef {{after: Set<string>}} OrderParams */

/** @type {Map<string, OrderParams>} */
const orderParamsCache = new Map()

/**
 *
 * @param {Plugin} plugin
 * @returns {OrderParams}
 */
function getOrderParams (plugin) {
  if (!process.env.VUE_CLI_TEST && orderParamsCache.has(plugin.id)) {
    return orderParamsCache.get(plugin.id)
  }
  const apply = plugin.apply

  let after = new Set()
  if (typeof apply.after === 'string') {
    after = new Set([apply.after])
  } else if (Array.isArray(apply.after)) {
    after = new Set(apply.after)
  }
  if (!process.env.VUE_CLI_TEST) {
    orderParamsCache.set(plugin.id, { after })
  }

  return { after }
}

/**
 * See leetcode 210
 * @param {Array<Plugin>} plugins
 * @returns {Array<Plugin>}
 */
function topologicalSorting (plugins) {
  /** @type {Map<string, Plugin>} */
  const pluginsMap = new Map(plugins.map(p => [p.id, p]))

  /** @type {Map<Plugin, number>} */
  const indegrees = new Map()

  /** @type {Map<Plugin, Array<Plugin>>} */
  const graph = new Map()

  plugins.forEach(p => {
    const after = getOrderParams(p).after
    indegrees.set(p, after.size)
    if (after.size === 0) return
    for (const id of after) {
      const prerequisite = pluginsMap.get(id)
      // remove invalid data
      if (!prerequisite) {
        indegrees.set(p, indegrees.get(p) - 1)
        continue
      }

      if (!graph.has(prerequisite)) {
        graph.set(prerequisite, [])
      }
      graph.get(prerequisite).push(p)
    }
  })

  const res = []
  const queue = []
  indegrees.forEach((d, p) => {
    if (d === 0) queue.push(p)
  })
  while (queue.length) {
    const cur = queue.shift()
    res.push(cur)
    const neighbors = graph.get(cur)
    if (!neighbors) continue

    neighbors.forEach(n => {
      const degree = indegrees.get(n) - 1
      indegrees.set(n, degree)
      if (degree === 0) {
        queue.push(n)
      }
    })
  }
  const valid = res.length === plugins.length
  if (!valid) {
    warn(`No proper plugin execution order found.`)
    return plugins
  }
  return res
}

/**
 * Arrange plugins by 'after' property.
 * @param {Array<Plugin>} plugins
 * @returns {Array<Plugin>}
 */
function sortPlugins (plugins) {
  if (plugins.length < 2) return plugins

  return topologicalSorting(plugins)
}

module.exports = {
  topologicalSorting,
  sortPlugins
}
