module.exports = function formatStats (stats, dir, api) {
  const fs = require('fs')
  const path = require('path')
  const zlib = require('zlib')
  const ui = require('cliui')({ width: process.stdout.columns || 80 })
  const { chalk } = require('@vue/cli-shared-utils')

  const json = stats.toJson({
    hash: false,
    modules: false,
    chunks: false
  })

  let assets = json.assets
    ? json.assets
    : json.children.reduce((acc, child) => acc.concat(child.assets), [])

  const seenNames = new Map()
  const isJS = val => /\.js$/.test(val)
  const isCSS = val => /\.css$/.test(val)
  const isMinJS = val => /\.min\.js$/.test(val)
  assets = assets
    .map(a => {
      a.name = a.name.split('?')[0]
      return a
    })
    .filter(a => {
      if (seenNames.has(a.name)) {
        return false
      }
      seenNames.set(a.name, true)
      return isJS(a.name) || isCSS(a.name)
    })
    .sort((a, b) => {
      if (isJS(a.name) && isCSS(b.name)) return -1
      if (isCSS(a.name) && isJS(b.name)) return 1
      if (isMinJS(a.name) && !isMinJS(b.name)) return -1
      if (!isMinJS(a.name) && isMinJS(b.name)) return 1
      return b.size - a.size
    })

  function formatSize (size) {
    return (size / 1024).toFixed(2) + ' KiB'
  }

  function getGzippedSize (asset) {
    const filepath = api.resolve(path.join(dir, asset.name))
    const buffer = fs.readFileSync(filepath)
    return formatSize(zlib.gzipSync(buffer).length)
  }

  function makeRow (a, b, c) {
    return `  ${a}\t    ${b}\t ${c}`
  }

  ui.div(
    makeRow(
      chalk.cyan.bold(`File`),
      chalk.cyan.bold(`Size`),
      chalk.cyan.bold(`Gzipped`)
    ) + `\n\n` +
    assets.map(asset => makeRow(
      /js$/.test(asset.name)
        ? chalk.green(path.join(dir, asset.name))
        : chalk.blue(path.join(dir, asset.name)),
      formatSize(asset.size),
      getGzippedSize(asset)
    )).join(`\n`)
  )

  const time = stats.endTime - stats.startTime
  const now = new Date().toISOString()
  const hash = stats.hash
  const info = `Build at: ${chalk.white(now)} - Hash: ${chalk.white(hash)} - Time: ${chalk.white(time)}ms`

  return `${ui.toString()}\n\n  ${chalk.gray(`Images and other types of assets omitted.`)}\n  ${info}\n`
}
