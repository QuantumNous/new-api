// From https://github.com/FormidableLabs/webpack-dashboard/blob/7f99b31c5f00a7818d8129cb8a8fc6eb1b71799c/plugin/index.js
// Modified by Guillaume Chau (Akryum)

/* eslint-disable max-params, max-statements */
'use strict'

const path = require('path')
const fs = require('fs-extra')
const webpack = require('webpack')
const { IpcMessenger } = require('@vue/cli-shared-utils')
const { analyzeBundle } = require('./analyzeBundle')

const ID = 'vue-cli-dashboard-plugin'
const ONE_SECOND = 1000
const FILENAME_QUERY_REGEXP = /\?.*$/

const ipc = new IpcMessenger()

function getTimeMessage (timer) {
  let time = Date.now() - timer

  if (time >= ONE_SECOND) {
    time /= ONE_SECOND
    time = Math.round(time)
    time += 's'
  } else {
    time += 'ms'
  }

  return ` (${time})`
}

class DashboardPlugin {
  constructor (options) {
    this.type = options.type
    if (this.type === 'build' && options.moduleBuild) {
      this.type = 'build-modern'
    }
    this.watching = false
    this.autoDisconnect = !options.keepAlive
  }

  cleanup () {
    this.sendData = null
    if (this.autoDisconnect) ipc.disconnect()
  }

  apply (compiler) {
    let sendData = this.sendData
    let timer
    let inProgress = false

    let assetSources = new Map()

    if (!sendData) {
      sendData = data => ipc.send({
        webpackDashboardData: {
          type: this.type,
          value: data
        }
      })
    }

    // Progress status
    let progressTime = Date.now()
    const progressPlugin = new webpack.ProgressPlugin((percent, msg) => {
      // in webpack 5, progress plugin will continue sending progresses even after the done hook
      // for things like caching, causing the progress indicator stuck at 0.99
      // so we have to use a flag to stop sending such `compiling` progress data
      if (!inProgress) {
        return
      }

      // Debouncing
      const time = Date.now()
      if (time - progressTime > 300) {
        progressTime = time
        sendData([
          {
            type: 'status',
            value: 'Compiling'
          },
          {
            type: 'progress',
            value: percent
          },
          {
            type: 'operations',
            value: msg + getTimeMessage(timer)
          }
        ])
      }
    })
    progressPlugin.apply(compiler)

    compiler.hooks.watchRun.tap(ID, c => {
      this.watching = true
    })

    compiler.hooks.run.tap(ID, c => {
      this.watching = false
    })

    compiler.hooks.compile.tap(ID, () => {
      inProgress = true
      timer = Date.now()

      sendData([
        {
          type: 'status',
          value: 'Compiling'
        },
        {
          type: 'progress',
          value: 0
        }
      ])
    })

    compiler.hooks.invalid.tap(ID, () => {
      sendData([
        {
          type: 'status',
          value: 'Invalidated'
        },
        {
          type: 'progress',
          value: 0
        },
        {
          type: 'operations',
          value: 'idle'
        }
      ])
    })

    compiler.hooks.failed.tap(ID, () => {
      sendData([
        {
          type: 'status',
          value: 'Failed'
        },
        {
          type: 'operations',
          value: `idle${getTimeMessage(timer)}`
        }
      ])
      inProgress = false
    })

    compiler.hooks.afterEmit.tap(ID, compilation => {
      assetSources = new Map()
      for (const name in compilation.assets) {
        const asset = compilation.assets[name]
        const filename = name.replace(FILENAME_QUERY_REGEXP, '')
        try {
          assetSources.set(filename, asset.source())
        } catch (e) {
          const webpackFs = compiler.outputFileSystem
          const fullPath = (webpackFs.join || path.join)(compiler.options.output.path, filename)
          const buf = webpackFs.readFileSync(fullPath)
          assetSources.set(filename, buf.toString())
        }
      }
    })

    compiler.hooks.done.tap(ID, stats => {
      let statsData = stats.toJson()
      // Sometimes all the information is located in `children` array
      if ((!statsData.assets || !statsData.assets.length) && statsData.children && statsData.children.length) {
        statsData = statsData.children[0]
      }

      const outputPath = compiler.options.output.path
      statsData.assets.forEach(asset => {
        // Removing query part from filename (yes, somebody uses it for some reason and Webpack supports it)
        asset.name = asset.name.replace(FILENAME_QUERY_REGEXP, '')
        asset.fullPath = path.join(outputPath, asset.name)
      })
      // Analyze the assets and update sizes on assets and modules
      analyzeBundle(statsData, assetSources)

      const hasErrors = stats.hasErrors()

      sendData([
        {
          type: 'status',
          value: hasErrors ? 'Failed' : 'Success'
        },
        {
          type: 'progress',
          value: 1
        },
        {
          type: 'operations',
          value: `idle${getTimeMessage(timer)}`
        }
      ])
      inProgress = false

      const statsFile = path.resolve(process.cwd(), `./node_modules/.stats-${this.type}.json`)
      fs.writeJson(statsFile, {
        errors: hasErrors,
        warnings: stats.hasWarnings(),
        data: statsData
      }).then(() => {
        sendData([
          {
            type: 'stats'
          }
        ])

        if (!this.watching) {
          this.cleanup()
        }
      }).catch(error => {
        console.error(error)
      })
    })
  }
}

module.exports = DashboardPlugin
