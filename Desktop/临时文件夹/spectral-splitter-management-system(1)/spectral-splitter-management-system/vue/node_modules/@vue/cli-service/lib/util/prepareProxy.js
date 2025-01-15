/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file at
 * https://github.com/facebookincubator/create-react-app/blob/master/LICENSE
 */

const fs = require('fs')
const url = require('url')
const path = require('path')
const { chalk } = require('@vue/cli-shared-utils')
const address = require('address')

const defaultConfig = {
  logLevel: 'silent',
  secure: false,
  changeOrigin: true,
  ws: true,
  xfwd: true
}

module.exports = function prepareProxy (proxy, appPublicFolder) {
  // `proxy` lets you specify alternate servers for specific requests.
  // It can either be a string or an object conforming to the Webpack dev server proxy configuration
  // https://webpack.github.io/docs/webpack-dev-server.html
  if (!proxy) {
    return undefined
  }
  if (Array.isArray(proxy) || (typeof proxy !== 'object' && typeof proxy !== 'string')) {
    console.log(
      chalk.red(
        'When specified, "proxy" in package.json must be a string or an object.'
      )
    )
    console.log(
      chalk.red('Instead, the type of "proxy" was "' + typeof proxy + '".')
    )
    console.log(
      chalk.red(
        'Either remove "proxy" from package.json, or make it an object.'
      )
    )
    process.exit(1)
  }

  // If proxy is specified, let it handle any request except for
  // files in the public folder and requests to the WebpackDevServer socket endpoint.
  // https://github.com/facebook/create-react-app/issues/6720
  function mayProxy (pathname) {
    const maybePublicPath = path.resolve(appPublicFolder, pathname.slice(1))
    const isPublicFileRequest = fs.existsSync(maybePublicPath) && fs.statSync(maybePublicPath).isFile()
    const isWdsEndpointRequest = pathname.startsWith('/sockjs-node') // used by webpackHotDevClient
    return !(isPublicFileRequest || isWdsEndpointRequest)
  }

  function createProxyEntry (target, usersOnProxyReq, context) {
    // #2478
    // There're a little-known use case that the `target` field is an object rather than a string
    // https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/https.md
    if (typeof target === 'string' && process.platform === 'win32') {
      target = resolveLoopback(target)
    }
    return {
      target,
      context (pathname, req) {
        // is a static asset
        if (!mayProxy(pathname)) {
          return false
        }
        if (context) {
          // Explicit context, e.g. /api
          return pathname.match(context)
        } else {
          // not a static request
          if (req.method !== 'GET') {
            return true
          }
          // Heuristics: if request `accept`s text/html, we pick /index.html.
          // Modern browsers include text/html into `accept` header when navigating.
          // However API calls like `fetch()` won’t generally accept text/html.
          // If this heuristic doesn’t work well for you, use a custom `proxy` object.
          return (
            req.headers.accept &&
            req.headers.accept.indexOf('text/html') === -1
          )
        }
      },
      onProxyReq (proxyReq, req, res) {
        if (usersOnProxyReq) {
          usersOnProxyReq(proxyReq, req, res)
        }
        // Browsers may send Origin headers even with same-origin
        // requests. To prevent CORS issues, we have to change
        // the Origin to match the target URL.
        if (!proxyReq.agent && proxyReq.getHeader('origin')) {
          proxyReq.setHeader('origin', target)
        }
      },
      onError: onProxyError(target)
    }
  }

  // Support proxy as a string for those who are using the simple proxy option
  if (typeof proxy === 'string') {
    if (!/^http(s)?:\/\//.test(proxy)) {
      console.log(
        chalk.red(
          'When "proxy" is specified in package.json it must start with either http:// or https://'
        )
      )
      process.exit(1)
    }

    return [
      Object.assign({}, defaultConfig, createProxyEntry(proxy))
    ]
  }

  // Otherwise, proxy is an object so create an array of proxies to pass to webpackDevServer
  return Object.keys(proxy).map(context => {
    const config = proxy[context]
    if (!Object.prototype.hasOwnProperty.call(config, 'target')) {
      console.log(
        chalk.red(
          'When `proxy` in package.json is an object, each `context` object must have a ' +
            '`target` property specified as a url string'
        )
      )
      process.exit(1)
    }
    const entry = createProxyEntry(config.target, config.onProxyReq, context)
    return Object.assign({}, defaultConfig, config, entry)
  })
}

function resolveLoopback (proxy) {
  const o = new url.URL(proxy)
  o.host = undefined
  if (o.hostname !== 'localhost') {
    return proxy
  }
  // Unfortunately, many languages (unlike node) do not yet support IPv6.
  // This means even though localhost resolves to ::1, the application
  // must fall back to IPv4 (on 127.0.0.1).
  // We can re-enable this in a few years.
  /* try {
    o.hostname = address.ipv6() ? '::1' : '127.0.0.1';
  } catch (_ignored) {
    o.hostname = '127.0.0.1';
  } */

  try {
    // Check if we're on a network; if we are, chances are we can resolve
    // localhost. Otherwise, we can just be safe and assume localhost is
    // IPv4 for maximum compatibility.
    if (!address.ip()) {
      o.hostname = '127.0.0.1'
    }
  } catch (_ignored) {
    o.hostname = '127.0.0.1'
  }
  return url.format(o)
}

// We need to provide a custom onError function for httpProxyMiddleware.
// It allows us to log custom error messages on the console.
function onProxyError (proxy) {
  return (err, req, res) => {
    const host = req.headers && req.headers.host
    console.log(
      chalk.red('Proxy error:') +
        ' Could not proxy request ' +
        chalk.cyan(req.url) +
        ' from ' +
        chalk.cyan(host) +
        ' to ' +
        chalk.cyan(proxy) +
        '.'
    )
    console.log(
      'See https://nodejs.org/api/errors.html#errors_common_system_errors for more information (' +
        chalk.cyan(err.code) +
        ').'
    )
    console.log()

    // And immediately send the proper error response to the client.
    // Otherwise, the request will eventually timeout with ERR_EMPTY_RESPONSE on the client side.
    if (res.writeHead && !res.headersSent) {
      res.writeHead(500)
    }
    res.end(
      'Proxy error: Could not proxy request ' +
        req.url +
        ' from ' +
        host +
        ' to ' +
        proxy +
        ' (' +
        err.code +
        ').'
    )
  }
}
