const {
  info,
  error,
  hasProjectYarn,
  hasProjectPnpm,
  IpcMessenger
} = require('@vue/cli-shared-utils')
const getBaseUrl = require('../util/getBaseUrl')

const defaults = {
  host: '0.0.0.0',
  port: 8080,
  https: false
}

/** @type {import('@vue/cli-service').ServicePlugin} */
module.exports = (api, options) => {
  const baseUrl = getBaseUrl(options)
  api.registerCommand('serve', {
    description: 'start development server',
    usage: 'vue-cli-service serve [options] [entry]',
    options: {
      '--open': `open browser on server start`,
      '--copy': `copy url to clipboard on server start`,
      '--stdin': `close when stdin ends`,
      '--mode': `specify env mode (default: development)`,
      '--host': `specify host (default: ${defaults.host})`,
      '--port': `specify port (default: ${defaults.port})`,
      '--https': `use https (default: ${defaults.https})`,
      '--public': `specify the public network URL for the HMR client`,
      '--skip-plugins': `comma-separated list of plugin names to skip for this run`
    }
  }, async function serve (args) {
    info('Starting development server...')

    // although this is primarily a dev server, it is possible that we
    // are running it in a mode with a production env, e.g. in E2E tests.
    const isInContainer = checkInContainer()
    const isProduction = process.env.NODE_ENV === 'production'

    const { chalk } = require('@vue/cli-shared-utils')
    const webpack = require('webpack')
    const WebpackDevServer = require('webpack-dev-server')
    const portfinder = require('portfinder')
    const prepareURLs = require('../util/prepareURLs')
    const prepareProxy = require('../util/prepareProxy')
    const launchEditorMiddleware = require('launch-editor-middleware')
    const validateWebpackConfig = require('../util/validateWebpackConfig')
    const isAbsoluteUrl = require('../util/isAbsoluteUrl')

    // configs that only matters for dev server
    api.chainWebpack(webpackConfig => {
      if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
        if (!webpackConfig.get('devtool')) {
          webpackConfig
            .devtool('eval-cheap-module-source-map')
        }

        // https://github.com/webpack/webpack/issues/6642
        // https://github.com/vuejs/vue-cli/issues/3539
        webpackConfig
          .output
            .globalObject(`(typeof self !== 'undefined' ? self : this)`)

        if (
          !process.env.VUE_CLI_TEST &&
          (!options.devServer.client ||
            options.devServer.client.progress !== false)
        ) {
          // the default progress plugin won't show progress due to infrastructreLogging.level
          webpackConfig
            .plugin('progress')
            .use(require('progress-webpack-plugin'))
        }
      }
    })

    // resolve webpack config
    const webpackConfig = api.resolveWebpackConfig()

    // check for common config errors
    validateWebpackConfig(webpackConfig, api, options)

    // load user devServer options with higher priority than devServer
    // in webpack config
    const projectDevServerOptions = Object.assign(
      webpackConfig.devServer || {},
      options.devServer
    )

    // expose advanced stats
    if (args.dashboard) {
      const DashboardPlugin = require('../webpack/DashboardPlugin')
      webpackConfig.plugins.push(new DashboardPlugin({
        type: 'serve'
      }))
    }

    // entry arg
    const entry = args._[0]
    if (entry) {
      webpackConfig.entry = {
        app: api.resolve(entry)
      }
    }

    // resolve server options
    const modesUseHttps = ['https', 'http2']
    const serversUseHttps = ['https', 'spdy']
    const optionsUseHttps = modesUseHttps.some(modeName => !!projectDevServerOptions[modeName]) ||
      (typeof projectDevServerOptions.server === 'string' && serversUseHttps.includes(projectDevServerOptions.server)) ||
      (typeof projectDevServerOptions.server === 'object' && projectDevServerOptions.server !== null && serversUseHttps.includes(projectDevServerOptions.server.type))
    const useHttps = args.https || optionsUseHttps || defaults.https
    const protocol = useHttps ? 'https' : 'http'
    const host = args.host || process.env.HOST || projectDevServerOptions.host || defaults.host
    portfinder.basePort = args.port || process.env.PORT || projectDevServerOptions.port || defaults.port
    const port = await portfinder.getPortPromise()
    const rawPublicUrl = args.public || projectDevServerOptions.public
    const publicUrl = rawPublicUrl
      ? /^[a-zA-Z]+:\/\//.test(rawPublicUrl)
        ? rawPublicUrl
        : `${protocol}://${rawPublicUrl}`
      : null
    const publicHost = publicUrl ? /^[a-zA-Z]+:\/\/([^/?#]+)/.exec(publicUrl)[1] : undefined

    const urls = prepareURLs(
      protocol,
      host,
      port,
      isAbsoluteUrl(baseUrl) ? '/' : baseUrl
    )
    const localUrlForBrowser = publicUrl || urls.localUrlForBrowser

    const proxySettings = prepareProxy(
      projectDevServerOptions.proxy,
      api.resolve('public')
    )

    // inject dev & hot-reload middleware entries
    let webSocketURL
    if (!isProduction) {
      if (publicHost) {
        // explicitly configured via devServer.public
        webSocketURL = {
          protocol: protocol === 'https' ? 'wss' : 'ws',
          hostname: publicHost,
          port
        }
      } else if (isInContainer) {
        // can't infer public network url if inside a container
        // infer it from the browser instead
        webSocketURL = 'auto://0.0.0.0:0/ws'
      } else {
        // otherwise infer the url from the config
        webSocketURL = {
          protocol: protocol === 'https' ? 'wss' : 'ws',
          hostname: urls.lanUrlForConfig || 'localhost',
          port
        }
      }

      if (process.env.APPVEYOR) {
        webpackConfig.plugins.push(
          new webpack.EntryPlugin(__dirname, 'webpack/hot/poll?500', { name: undefined })
        )
      }
    }

    const { projectTargets } = require('../util/targets')
    const supportsIE = !!projectTargets
    if (supportsIE) {
      webpackConfig.plugins.push(
        // must use undefined as name,
        // to avoid dev server establishing an extra ws connection for the new entry
        new webpack.EntryPlugin(__dirname, 'whatwg-fetch', { name: undefined })
      )
    }

    // fixme: temporary fix to suppress dev server logging
    // should be more robust to show necessary info but not duplicate errors
    webpackConfig.infrastructureLogging = { ...webpackConfig.infrastructureLogging, level: 'none' }
    webpackConfig.stats = 'errors-only'

    // create compiler
    const compiler = webpack(webpackConfig)

    // handle compiler error
    compiler.hooks.failed.tap('vue-cli-service serve', msg => {
      error(msg)
      process.exit(1)
    })

    // create server
    const server = new WebpackDevServer(Object.assign({
      historyApiFallback: {
        disableDotRule: true,
        htmlAcceptHeaders: [
          'text/html',
          'application/xhtml+xml'
        ],
        rewrites: genHistoryApiFallbackRewrites(baseUrl, options.pages)
      },
      hot: !isProduction
    }, projectDevServerOptions, {
      host,
      port,

      server: {
        type: protocol,
        ...(typeof projectDevServerOptions.server === 'object'
          ? projectDevServerOptions.server
          : {})
      },

      proxy: proxySettings,

      static: {
        directory: api.resolve('public'),
        publicPath: options.publicPath,
        watch: !isProduction,

        ...projectDevServerOptions.static
      },

      client: {
        webSocketURL,

        logging: 'none',
        overlay: isProduction // TODO disable this
          ? false
          : { warnings: false, errors: true },
        progress: !process.env.VUE_CLI_TEST,

        ...projectDevServerOptions.client
      },

      open: args.open || projectDevServerOptions.open,
      setupExitSignals: true,

      setupMiddlewares (middlewares, devServer) {
        // launch editor support.
        // this works with vue-devtools & @vue/cli-overlay
        devServer.app.use('/__open-in-editor', launchEditorMiddleware(() => console.log(
          `To specify an editor, specify the EDITOR env variable or ` +
          `add "editor" field to your Vue project config.\n`
        )))

        // allow other plugins to register middlewares, e.g. PWA
        // todo: migrate to the new API interface
        api.service.devServerConfigFns.forEach(fn => fn(devServer.app, devServer))

        if (projectDevServerOptions.setupMiddlewares) {
          return projectDevServerOptions.setupMiddlewares(middlewares, devServer)
        }

        return middlewares
      }
    }), compiler)

    if (args.stdin) {
      process.stdin.on('end', () => {
        server.stopCallback(() => {
          process.exit(0)
        })
      })

      process.stdin.resume()
    }

    // on appveyor, killing the process with SIGTERM causes execa to
    // throw error
    if (process.env.VUE_CLI_TEST) {
      process.stdin.on('data', data => {
        if (data.toString() === 'close') {
          console.log('got close signal!')
          server.stopCallback(() => {
            process.exit(0)
          })
        }
      })
    }

    return new Promise((resolve, reject) => {
      // log instructions & open browser on first compilation complete
      let isFirstCompile = true
      compiler.hooks.done.tap('vue-cli-service serve', stats => {
        if (stats.hasErrors()) {
          return
        }

        let copied = ''
        if (isFirstCompile && args.copy) {
          try {
            require('clipboardy').writeSync(localUrlForBrowser)
            copied = chalk.dim('(copied to clipboard)')
          } catch (_) {
            /* catch exception if copy to clipboard isn't supported (e.g. WSL), see issue #3476 */
          }
        }

        const networkUrl = publicUrl
          ? publicUrl.replace(/([^/])$/, '$1/')
          : urls.lanUrlForTerminal

        console.log()
        console.log(`  App running at:`)
        console.log(`  - Local:   ${chalk.cyan(urls.localUrlForTerminal)} ${copied}`)
        if (!isInContainer) {
          console.log(`  - Network: ${chalk.cyan(networkUrl)}`)
        } else {
          console.log()
          console.log(chalk.yellow(`  It seems you are running Vue CLI inside a container.`))
          if (!publicUrl && options.publicPath && options.publicPath !== '/') {
            console.log()
            console.log(chalk.yellow(`  Since you are using a non-root publicPath, the hot-reload socket`))
            console.log(chalk.yellow(`  will not be able to infer the correct URL to connect. You should`))
            console.log(chalk.yellow(`  explicitly specify the URL via ${chalk.blue(`devServer.public`)}.`))
            console.log()
          }
          console.log(chalk.yellow(`  Access the dev server via ${chalk.cyan(
            `${protocol}://localhost:<your container's external mapped port>${options.publicPath}`
          )}`))
        }
        console.log()

        if (isFirstCompile) {
          isFirstCompile = false

          if (!isProduction) {
            const buildCommand = hasProjectYarn(api.getCwd()) ? `yarn build` : hasProjectPnpm(api.getCwd()) ? `pnpm run build` : `npm run build`
            console.log(`  Note that the development build is not optimized.`)
            console.log(`  To create a production build, run ${chalk.cyan(buildCommand)}.`)
          } else {
            console.log(`  App is served in production mode.`)
            console.log(`  Note this is for preview or E2E testing only.`)
          }
          console.log()

          // Send final app URL
          if (args.dashboard) {
            const ipc = new IpcMessenger()
            ipc.send({
              vueServe: {
                url: localUrlForBrowser
              }
            })
          }

          // resolve returned Promise
          // so other commands can do api.service.run('serve').then(...)
          resolve({
            server,
            url: localUrlForBrowser
          })
        } else if (process.env.VUE_CLI_TEST) {
          // signal for test to check HMR
          console.log('App updated')
        }
      })

      server.start().catch(err => reject(err))
    })
  })
}

// https://stackoverflow.com/a/20012536
function checkInContainer () {
  if ('CODESANDBOX_SSE' in process.env) {
    return true
  }
  const fs = require('fs')
  if (fs.existsSync(`/proc/1/cgroup`)) {
    const content = fs.readFileSync(`/proc/1/cgroup`, 'utf-8')
    return /:\/(lxc|docker|kubepods(\.slice)?)\//.test(content)
  }
}

function genHistoryApiFallbackRewrites (baseUrl, pages = {}) {
  const path = require('path')
  const multiPageRewrites = Object
    .keys(pages)
    // sort by length in reversed order to avoid overrides
    // eg. 'page11' should appear in front of 'page1'
    .sort((a, b) => b.length - a.length)
    .map(name => ({
      from: new RegExp(`^/${name}`),
      to: path.posix.join(baseUrl, pages[name].filename || `${name}.html`)
    }))
  return [
    ...multiPageRewrites,
    { from: /./, to: path.posix.join(baseUrl, 'index.html') }
  ]
}

module.exports.defaultModes = {
  serve: 'development'
}
