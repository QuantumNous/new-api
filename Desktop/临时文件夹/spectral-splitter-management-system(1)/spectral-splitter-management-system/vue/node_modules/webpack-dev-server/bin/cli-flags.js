"use strict";

module.exports = {
  "allowed-hosts": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Allows to enumerate the hosts from which access to the dev server are allowed (useful when you are proxying dev server, by default is 'auto').",
        path: "allowedHosts[]",
      },
      {
        description:
          "Allows to enumerate the hosts from which access to the dev server are allowed (useful when you are proxying dev server, by default is 'auto').",
        multiple: false,
        path: "allowedHosts",
        type: "enum",
        values: ["auto", "all"],
      },
    ],
    description:
      "Allows to enumerate the hosts from which access to the dev server are allowed (useful when you are proxying dev server, by default is 'auto').",
    multiple: true,
    simpleType: "string",
  },
  "allowed-hosts-reset": {
    configs: [
      {
        type: "reset",
        multiple: false,
        description:
          "Clear all items provided in 'allowedHosts' configuration. Allows to enumerate the hosts from which access to the dev server are allowed (useful when you are proxying dev server, by default is 'auto').",
        path: "allowedHosts",
      },
    ],
    description:
      "Clear all items provided in 'allowedHosts' configuration. Allows to enumerate the hosts from which access to the dev server are allowed (useful when you are proxying dev server, by default is 'auto').",
    simpleType: "boolean",
    multiple: false,
  },
  bonjour: {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Allows to broadcasts dev server via ZeroConf networking on start.",
        negatedDescription:
          "Disallows to broadcasts dev server via ZeroConf networking on start.",
        path: "bonjour",
      },
    ],
    description:
      "Allows to broadcasts dev server via ZeroConf networking on start.",
    simpleType: "boolean",
    multiple: false,
  },
  client: {
    configs: [
      {
        description:
          "Allows to specify options for client script in the browser or disable client script.",
        negatedDescription: "Disables client script.",
        multiple: false,
        path: "client",
        type: "enum",
        values: [false],
      },
    ],
    description:
      "Allows to specify options for client script in the browser or disable client script.",
    multiple: false,
    simpleType: "boolean",
  },
  "client-logging": {
    configs: [
      {
        type: "enum",
        values: ["none", "error", "warn", "info", "log", "verbose"],
        multiple: false,
        description: "Allows to set log level in the browser.",
        path: "client.logging",
      },
    ],
    description: "Allows to set log level in the browser.",
    simpleType: "string",
    multiple: false,
  },
  "client-overlay": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Enables a full-screen overlay in the browser when there are compiler errors or warnings.",
        negatedDescription:
          "Disables the full-screen overlay in the browser when there are compiler errors or warnings.",
        path: "client.overlay",
      },
    ],
    description:
      "Enables a full-screen overlay in the browser when there are compiler errors or warnings.",
    simpleType: "boolean",
    multiple: false,
  },
  "client-overlay-errors": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Enables a full-screen overlay in the browser when there are compiler errors.",
        negatedDescription:
          "Disables the full-screen overlay in the browser when there are compiler errors.",
        path: "client.overlay.errors",
      },
    ],
    description:
      "Enables a full-screen overlay in the browser when there are compiler errors.",
    simpleType: "boolean",
    multiple: false,
  },
  "client-overlay-trusted-types-policy-name": {
    configs: [
      {
        description:
          "The name of a Trusted Types policy for the overlay. Defaults to 'webpack-dev-server#overlay'.",
        multiple: false,
        path: "client.overlay.trustedTypesPolicyName",
        type: "string",
      },
    ],
    description:
      "The name of a Trusted Types policy for the overlay. Defaults to 'webpack-dev-server#overlay'.",
    multiple: false,
    simpleType: "string",
  },
  "client-overlay-warnings": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Enables a full-screen overlay in the browser when there are compiler warnings.",
        negatedDescription:
          "Disables the full-screen overlay in the browser when there are compiler warnings.",
        path: "client.overlay.warnings",
      },
    ],
    description:
      "Enables a full-screen overlay in the browser when there are compiler warnings.",
    simpleType: "boolean",
    multiple: false,
  },
  "client-overlay-runtime-errors": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Enables a full-screen overlay in the browser when there are uncaught runtime errors.",
        negatedDescription:
          "Disables the full-screen overlay in the browser when there are uncaught runtime errors.",
        path: "client.overlay.runtimeErrors",
      },
    ],
    description:
      "Enables a full-screen overlay in the browser when there are uncaught runtime errors.",
    simpleType: "boolean",
    multiple: false,
  },
  "client-progress": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Prints compilation progress in percentage in the browser.",
        negatedDescription:
          "Does not print compilation progress in percentage in the browser.",
        path: "client.progress",
      },
    ],
    description: "Prints compilation progress in percentage in the browser.",
    simpleType: "boolean",
    multiple: false,
  },
  "client-reconnect": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Tells dev-server the number of times it should try to reconnect the client.",
        negatedDescription:
          "Tells dev-server to not to try to reconnect the client.",
        path: "client.reconnect",
      },
      {
        type: "number",
        multiple: false,
        description:
          "Tells dev-server the number of times it should try to reconnect the client.",
        path: "client.reconnect",
      },
    ],
    description:
      "Tells dev-server the number of times it should try to reconnect the client.",
    simpleType: "string",
    multiple: false,
  },
  "client-web-socket-transport": {
    configs: [
      {
        type: "enum",
        values: ["sockjs", "ws"],
        multiple: false,
        description:
          "Allows to set custom web socket transport to communicate with dev server.",
        path: "client.webSocketTransport",
      },
      {
        type: "string",
        multiple: false,
        description:
          "Allows to set custom web socket transport to communicate with dev server.",
        path: "client.webSocketTransport",
      },
    ],
    description:
      "Allows to set custom web socket transport to communicate with dev server.",
    simpleType: "string",
    multiple: false,
  },
  "client-web-socket-url": {
    configs: [
      {
        type: "string",
        multiple: false,
        description:
          "Allows to specify URL to web socket server (useful when you're proxying dev server and client script does not always know where to connect to).",
        path: "client.webSocketURL",
      },
    ],
    description:
      "Allows to specify URL to web socket server (useful when you're proxying dev server and client script does not always know where to connect to).",
    simpleType: "string",
    multiple: false,
  },
  "client-web-socket-url-hostname": {
    configs: [
      {
        type: "string",
        multiple: false,
        description:
          "Tells clients connected to devServer to use the provided hostname.",
        path: "client.webSocketURL.hostname",
      },
    ],
    description:
      "Tells clients connected to devServer to use the provided hostname.",
    simpleType: "string",
    multiple: false,
  },
  "client-web-socket-url-password": {
    configs: [
      {
        type: "string",
        multiple: false,
        description:
          "Tells clients connected to devServer to use the provided password to authenticate.",
        path: "client.webSocketURL.password",
      },
    ],
    description:
      "Tells clients connected to devServer to use the provided password to authenticate.",
    simpleType: "string",
    multiple: false,
  },
  "client-web-socket-url-pathname": {
    configs: [
      {
        type: "string",
        multiple: false,
        description:
          "Tells clients connected to devServer to use the provided path to connect.",
        path: "client.webSocketURL.pathname",
      },
    ],
    description:
      "Tells clients connected to devServer to use the provided path to connect.",
    simpleType: "string",
    multiple: false,
  },
  "client-web-socket-url-port": {
    configs: [
      {
        type: "number",
        multiple: false,
        description:
          "Tells clients connected to devServer to use the provided port.",
        path: "client.webSocketURL.port",
      },
      {
        description:
          "Tells clients connected to devServer to use the provided port.",
        multiple: false,
        path: "client.webSocketURL.port",
        type: "string",
      },
    ],
    description:
      "Tells clients connected to devServer to use the provided port.",
    simpleType: "string",
    multiple: false,
  },
  "client-web-socket-url-protocol": {
    configs: [
      {
        description:
          "Tells clients connected to devServer to use the provided protocol.",
        multiple: false,
        path: "client.webSocketURL.protocol",
        type: "enum",
        values: ["auto"],
      },
      {
        description:
          "Tells clients connected to devServer to use the provided protocol.",
        multiple: false,
        path: "client.webSocketURL.protocol",
        type: "string",
      },
    ],
    description:
      "Tells clients connected to devServer to use the provided protocol.",
    multiple: false,
    simpleType: "string",
  },
  "client-web-socket-url-username": {
    configs: [
      {
        type: "string",
        multiple: false,
        description:
          "Tells clients connected to devServer to use the provided username to authenticate.",
        path: "client.webSocketURL.username",
      },
    ],
    description:
      "Tells clients connected to devServer to use the provided username to authenticate.",
    simpleType: "string",
    multiple: false,
  },
  compress: {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description: "Enables gzip compression for everything served.",
        negatedDescription: "Disables gzip compression for everything served.",
        path: "compress",
      },
    ],
    description: "Enables gzip compression for everything served.",
    simpleType: "boolean",
    multiple: false,
  },
  "history-api-fallback": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Allows to proxy requests through a specified index page (by default 'index.html'), useful for Single Page Applications that utilise the HTML5 History API.",
        negatedDescription:
          "Disallows to proxy requests through a specified index page.",
        path: "historyApiFallback",
      },
    ],
    description:
      "Allows to proxy requests through a specified index page (by default 'index.html'), useful for Single Page Applications that utilise the HTML5 History API.",
    simpleType: "boolean",
    multiple: false,
  },
  host: {
    configs: [
      {
        description: "Allows to specify a hostname to use.",
        multiple: false,
        path: "host",
        type: "enum",
        values: ["local-ip", "local-ipv4", "local-ipv6"],
      },
      {
        description: "Allows to specify a hostname to use.",
        multiple: false,
        path: "host",
        type: "string",
      },
    ],
    description: "Allows to specify a hostname to use.",
    simpleType: "string",
    multiple: false,
  },
  hot: {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description: "Enables Hot Module Replacement.",
        negatedDescription: "Disables Hot Module Replacement.",
        path: "hot",
      },
      {
        type: "enum",
        values: ["only"],
        multiple: false,
        description: "Enables Hot Module Replacement.",
        path: "hot",
      },
    ],
    description: "Enables Hot Module Replacement.",
    simpleType: "string",
    multiple: false,
  },
  http2: {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Allows to serve over HTTP/2 using SPDY. Deprecated, use the `server` option.",
        negatedDescription: "Does not serve over HTTP/2 using SPDY.",
        path: "http2",
      },
    ],
    description:
      "Allows to serve over HTTP/2 using SPDY. Deprecated, use the `server` option.",
    simpleType: "boolean",
    multiple: false,
  },
  https: {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Allows to configure the server's listening socket for TLS (by default, dev server will be served over HTTP). Deprecated, use the `server` option.",
        negatedDescription:
          "Disallows to configure the server's listening socket for TLS (by default, dev server will be served over HTTP).",
        path: "https",
      },
    ],
    description:
      "Allows to configure the server's listening socket for TLS (by default, dev server will be served over HTTP). Deprecated, use the `server` option.",
    simpleType: "boolean",
    multiple: false,
  },
  "https-ca": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
        path: "https.ca[]",
      },
    ],
    description:
      "Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
    simpleType: "string",
    multiple: true,
  },
  "https-ca-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'https.ca' configuration. Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
        multiple: false,
        path: "https.ca",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'https.ca' configuration. Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
    multiple: false,
    simpleType: "boolean",
  },
  "https-cacert": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
        path: "https.cacert[]",
      },
    ],
    description:
      "Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
    simpleType: "string",
    multiple: true,
  },
  "https-cacert-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'https.cacert' configuration. Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
        multiple: false,
        path: "https.cacert",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'https.cacert' configuration. Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
    multiple: false,
    simpleType: "boolean",
  },
  "https-cert": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Path to an SSL certificate or content of an SSL certificate. Deprecated, use the `server.options.cert` option.",
        path: "https.cert[]",
      },
    ],
    description:
      "Path to an SSL certificate or content of an SSL certificate. Deprecated, use the `server.options.cert` option.",
    simpleType: "string",
    multiple: true,
  },
  "https-cert-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'https.cert' configuration. Path to an SSL certificate or content of an SSL certificate. Deprecated, use the `server.options.cert` option.",
        multiple: false,
        path: "https.cert",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'https.cert' configuration. Path to an SSL certificate or content of an SSL certificate. Deprecated, use the `server.options.cert` option.",
    multiple: false,
    simpleType: "boolean",
  },
  "https-crl": {
    configs: [
      {
        description:
          "Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists). Deprecated, use the `server.options.crl` option.",
        multiple: true,
        path: "https.crl[]",
        type: "string",
      },
    ],
    description:
      "Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists). Deprecated, use the `server.options.crl` option.",
    multiple: true,
    simpleType: "string",
  },
  "https-crl-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'https.crl' configuration. Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists). Deprecated, use the `server.options.crl` option.",
        multiple: false,
        path: "https.crl",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'https.crl' configuration. Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists). Deprecated, use the `server.options.crl` option.",
    multiple: false,
    simpleType: "boolean",
  },
  "https-key": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Path to an SSL key or content of an SSL key. Deprecated, use the `server.options.key` option.",
        path: "https.key[]",
      },
    ],
    description:
      "Path to an SSL key or content of an SSL key. Deprecated, use the `server.options.key` option.",
    simpleType: "string",
    multiple: true,
  },
  "https-key-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'https.key' configuration. Path to an SSL key or content of an SSL key. Deprecated, use the `server.options.key` option.",
        multiple: false,
        path: "https.key",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'https.key' configuration. Path to an SSL key or content of an SSL key. Deprecated, use the `server.options.key` option.",
    multiple: false,
    simpleType: "boolean",
  },
  "https-passphrase": {
    configs: [
      {
        type: "string",
        multiple: false,
        description:
          "Passphrase for a pfx file. Deprecated, use the `server.options.passphrase` option.",
        path: "https.passphrase",
      },
    ],
    description:
      "Passphrase for a pfx file. Deprecated, use the `server.options.passphrase` option.",
    simpleType: "string",
    multiple: false,
  },
  "https-pfx": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Path to an SSL pfx file or content of an SSL pfx file. Deprecated, use the `server.options.pfx` option.",
        path: "https.pfx[]",
      },
    ],
    description:
      "Path to an SSL pfx file or content of an SSL pfx file. Deprecated, use the `server.options.pfx` option.",
    simpleType: "string",
    multiple: true,
  },
  "https-pfx-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'https.pfx' configuration. Path to an SSL pfx file or content of an SSL pfx file. Deprecated, use the `server.options.pfx` option.",
        multiple: false,
        path: "https.pfx",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'https.pfx' configuration. Path to an SSL pfx file or content of an SSL pfx file. Deprecated, use the `server.options.pfx` option.",
    multiple: false,
    simpleType: "boolean",
  },
  "https-request-cert": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Request for an SSL certificate. Deprecated, use the `server.options.requestCert` option.",
        negatedDescription: "Does not request for an SSL certificate.",
        path: "https.requestCert",
      },
    ],
    description:
      "Request for an SSL certificate. Deprecated, use the `server.options.requestCert` option.",
    simpleType: "boolean",
    multiple: false,
  },
  ipc: {
    configs: [
      {
        type: "string",
        multiple: false,
        description: "Listen to a unix socket.",
        path: "ipc",
      },
      {
        type: "enum",
        values: [true],
        multiple: false,
        description: "Listen to a unix socket.",
        path: "ipc",
      },
    ],
    description: "Listen to a unix socket.",
    simpleType: "string",
    multiple: false,
  },
  "live-reload": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Enables reload/refresh the page(s) when file changes are detected (enabled by default).",
        negatedDescription:
          "Disables reload/refresh the page(s) when file changes are detected (enabled by default).",
        path: "liveReload",
      },
    ],
    description:
      "Enables reload/refresh the page(s) when file changes are detected (enabled by default).",
    simpleType: "boolean",
    multiple: false,
  },
  "magic-html": {
    configs: [
      {
        type: "boolean",
        multiple: false,
        description:
          "Tells dev-server whether to enable magic HTML routes (routes corresponding to your webpack output, for example '/main' for 'main.js').",
        negatedDescription:
          "Disables magic HTML routes (routes corresponding to your webpack output, for example '/main' for 'main.js').",
        path: "magicHtml",
      },
    ],
    description:
      "Tells dev-server whether to enable magic HTML routes (routes corresponding to your webpack output, for example '/main' for 'main.js').",
    simpleType: "boolean",
    multiple: false,
  },
  open: {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Allows to configure dev server to open the browser(s) and page(s) after server had been started (set it to true to open your default browser).",
        path: "open[]",
      },
      {
        type: "boolean",
        multiple: false,
        description:
          "Allows to configure dev server to open the browser(s) and page(s) after server had been started (set it to true to open your default browser).",
        negatedDescription: "Does not open the default browser.",
        path: "open",
      },
    ],
    description:
      "Allows to configure dev server to open the browser(s) and page(s) after server had been started (set it to true to open your default browser).",
    simpleType: "string",
    multiple: true,
  },
  "open-app": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Open specified browser. Deprecated: please use '--open-app-name'.",
        path: "open[].app",
      },
    ],
    description:
      "Open specified browser. Deprecated: please use '--open-app-name'.",
    simpleType: "string",
    multiple: true,
  },
  "open-app-name": {
    configs: [
      {
        type: "string",
        multiple: true,
        description: "Open specified browser.",
        path: "open[].app.name",
      },
      {
        type: "string",
        multiple: true,
        description: "Open specified browser.",
        path: "open.app.name[]",
      },
    ],
    description: "Open specified browser.",
    simpleType: "string",
    multiple: true,
  },
  "open-app-name-reset": {
    configs: [
      {
        type: "reset",
        multiple: false,
        description:
          "Clear all items provided in 'open.app.name' configuration. Open specified browser.",
        path: "open.app.name",
      },
    ],
    description:
      "Clear all items provided in 'open.app.name' configuration. Open specified browser.",
    simpleType: "boolean",
    multiple: false,
  },
  "open-reset": {
    configs: [
      {
        type: "reset",
        multiple: false,
        description:
          "Clear all items provided in 'open' configuration. Allows to configure dev server to open the browser(s) and page(s) after server had been started (set it to true to open your default browser).",
        path: "open",
      },
    ],
    description:
      "Clear all items provided in 'open' configuration. Allows to configure dev server to open the browser(s) and page(s) after server had been started (set it to true to open your default browser).",
    simpleType: "boolean",
    multiple: false,
  },
  "open-target": {
    configs: [
      {
        type: "string",
        multiple: true,
        description: "Opens specified page in browser.",
        path: "open[].target",
      },
      {
        type: "string",
        multiple: true,
        description: "Opens specified page in browser.",
        path: "open.target[]",
      },
    ],
    description: "Opens specified page in browser.",
    simpleType: "string",
    multiple: true,
  },
  "open-target-reset": {
    configs: [
      {
        type: "reset",
        multiple: false,
        description:
          "Clear all items provided in 'open.target' configuration. Opens specified page in browser.",
        path: "open.target",
      },
    ],
    description:
      "Clear all items provided in 'open.target' configuration. Opens specified page in browser.",
    simpleType: "boolean",
    multiple: false,
  },
  port: {
    configs: [
      {
        type: "number",
        multiple: false,
        description: "Allows to specify a port to use.",
        path: "port",
      },
      {
        type: "string",
        multiple: false,
        description: "Allows to specify a port to use.",
        path: "port",
      },
      {
        type: "enum",
        values: ["auto"],
        multiple: false,
        description: "Allows to specify a port to use.",
        path: "port",
      },
    ],
    description: "Allows to specify a port to use.",
    simpleType: "string",
    multiple: false,
  },
  "server-options-ca": {
    configs: [
      {
        description:
          "Path to an SSL CA certificate or content of an SSL CA certificate.",
        multiple: true,
        path: "server.options.ca[]",
        type: "string",
      },
    ],
    description:
      "Path to an SSL CA certificate or content of an SSL CA certificate.",
    multiple: true,
    simpleType: "string",
  },
  "server-options-ca-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'server.options.ca' configuration. Path to an SSL CA certificate or content of an SSL CA certificate.",
        multiple: false,
        path: "server.options.ca",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'server.options.ca' configuration. Path to an SSL CA certificate or content of an SSL CA certificate.",
    multiple: false,
    simpleType: "boolean",
  },
  "server-options-cacert": {
    configs: [
      {
        description:
          "Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
        multiple: true,
        path: "server.options.cacert[]",
        type: "string",
      },
    ],
    description:
      "Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
    multiple: true,
    simpleType: "string",
  },
  "server-options-cacert-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'server.options.cacert' configuration. Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
        multiple: false,
        path: "server.options.cacert",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'server.options.cacert' configuration. Path to an SSL CA certificate or content of an SSL CA certificate. Deprecated, use the `server.options.ca` option.",
    multiple: false,
    simpleType: "boolean",
  },
  "server-options-cert": {
    configs: [
      {
        description:
          "Path to an SSL certificate or content of an SSL certificate.",
        multiple: true,
        path: "server.options.cert[]",
        type: "string",
      },
    ],
    description: "Path to an SSL certificate or content of an SSL certificate.",
    multiple: true,
    simpleType: "string",
  },
  "server-options-cert-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'server.options.cert' configuration. Path to an SSL certificate or content of an SSL certificate.",
        multiple: false,
        path: "server.options.cert",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'server.options.cert' configuration. Path to an SSL certificate or content of an SSL certificate.",
    multiple: false,
    simpleType: "boolean",
  },
  "server-options-crl": {
    configs: [
      {
        description:
          "Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists).",
        multiple: true,
        path: "server.options.crl[]",
        type: "string",
      },
    ],
    description:
      "Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists).",
    multiple: true,
    simpleType: "string",
  },
  "server-options-crl-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'server.options.crl' configuration. Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists).",
        multiple: false,
        path: "server.options.crl",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'server.options.crl' configuration. Path to PEM formatted CRLs (Certificate Revocation Lists) or content of PEM formatted CRLs (Certificate Revocation Lists).",
    multiple: false,
    simpleType: "boolean",
  },
  "server-options-key": {
    configs: [
      {
        description: "Path to an SSL key or content of an SSL key.",
        multiple: true,
        path: "server.options.key[]",
        type: "string",
      },
    ],
    description: "Path to an SSL key or content of an SSL key.",
    multiple: true,
    simpleType: "string",
  },
  "server-options-key-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'server.options.key' configuration. Path to an SSL key or content of an SSL key.",
        multiple: false,
        path: "server.options.key",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'server.options.key' configuration. Path to an SSL key or content of an SSL key.",
    multiple: false,
    simpleType: "boolean",
  },
  "server-options-passphrase": {
    configs: [
      {
        description: "Passphrase for a pfx file.",
        multiple: false,
        path: "server.options.passphrase",
        type: "string",
      },
    ],
    description: "Passphrase for a pfx file.",
    multiple: false,
    simpleType: "string",
  },
  "server-options-pfx": {
    configs: [
      {
        description: "Path to an SSL pfx file or content of an SSL pfx file.",
        multiple: true,
        path: "server.options.pfx[]",
        type: "string",
      },
    ],
    description: "Path to an SSL pfx file or content of an SSL pfx file.",
    multiple: true,
    simpleType: "string",
  },
  "server-options-pfx-reset": {
    configs: [
      {
        description:
          "Clear all items provided in 'server.options.pfx' configuration. Path to an SSL pfx file or content of an SSL pfx file.",
        multiple: false,
        path: "server.options.pfx",
        type: "reset",
      },
    ],
    description:
      "Clear all items provided in 'server.options.pfx' configuration. Path to an SSL pfx file or content of an SSL pfx file.",
    multiple: false,
    simpleType: "boolean",
  },
  "server-options-request-cert": {
    configs: [
      {
        description: "Request for an SSL certificate.",
        negatedDescription: "Does not request for an SSL certificate.",
        multiple: false,
        path: "server.options.requestCert",
        type: "boolean",
      },
    ],
    description: "Request for an SSL certificate.",
    multiple: false,
    simpleType: "boolean",
  },
  "server-type": {
    configs: [
      {
        description: "Allows to set server and options (by default 'http').",
        multiple: false,
        path: "server.type",
        type: "enum",
        values: ["http", "https", "spdy"],
      },
    ],
    description: "Allows to set server and options (by default 'http').",
    multiple: false,
    simpleType: "string",
  },
  static: {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Allows to configure options for serving static files from directory (by default 'public' directory).",
        path: "static[]",
      },
      {
        type: "boolean",
        multiple: false,
        description:
          "Allows to configure options for serving static files from directory (by default 'public' directory).",
        negatedDescription:
          "Disallows to configure options for serving static files from directory.",
        path: "static",
      },
    ],
    description:
      "Allows to configure options for serving static files from directory (by default 'public' directory).",
    simpleType: "string",
    multiple: true,
  },
  "static-directory": {
    configs: [
      {
        type: "string",
        multiple: true,
        description: "Directory for static contents.",
        path: "static[].directory",
      },
    ],
    description: "Directory for static contents.",
    simpleType: "string",
    multiple: true,
  },
  "static-public-path": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "The static files will be available in the browser under this public path.",
        path: "static[].publicPath",
      },
      {
        type: "string",
        multiple: true,
        description:
          "The static files will be available in the browser under this public path.",
        path: "static.publicPath[]",
      },
    ],
    description:
      "The static files will be available in the browser under this public path.",
    simpleType: "string",
    multiple: true,
  },
  "static-public-path-reset": {
    configs: [
      {
        type: "reset",
        multiple: false,
        description:
          "Clear all items provided in 'static.publicPath' configuration. The static files will be available in the browser under this public path.",
        path: "static.publicPath",
      },
    ],
    description:
      "Clear all items provided in 'static.publicPath' configuration. The static files will be available in the browser under this public path.",
    simpleType: "boolean",
    multiple: false,
  },
  "static-reset": {
    configs: [
      {
        type: "reset",
        multiple: false,
        description:
          "Clear all items provided in 'static' configuration. Allows to configure options for serving static files from directory (by default 'public' directory).",
        path: "static",
      },
    ],
    description:
      "Clear all items provided in 'static' configuration. Allows to configure options for serving static files from directory (by default 'public' directory).",
    simpleType: "boolean",
    multiple: false,
  },
  "static-serve-index": {
    configs: [
      {
        type: "boolean",
        multiple: true,
        description:
          "Tells dev server to use serveIndex middleware when enabled.",
        negatedDescription:
          "Does not tell dev server to use serveIndex middleware.",
        path: "static[].serveIndex",
      },
    ],
    description: "Tells dev server to use serveIndex middleware when enabled.",
    simpleType: "boolean",
    multiple: true,
  },
  "static-watch": {
    configs: [
      {
        type: "boolean",
        multiple: true,
        description: "Watches for files in static content directory.",
        negatedDescription:
          "Does not watch for files in static content directory.",
        path: "static[].watch",
      },
    ],
    description: "Watches for files in static content directory.",
    simpleType: "boolean",
    multiple: true,
  },
  "watch-files": {
    configs: [
      {
        type: "string",
        multiple: true,
        description:
          "Allows to configure list of globs/directories/files to watch for file changes.",
        path: "watchFiles[]",
      },
    ],
    description:
      "Allows to configure list of globs/directories/files to watch for file changes.",
    simpleType: "string",
    multiple: true,
  },
  "watch-files-reset": {
    configs: [
      {
        type: "reset",
        multiple: false,
        description:
          "Clear all items provided in 'watchFiles' configuration. Allows to configure list of globs/directories/files to watch for file changes.",
        path: "watchFiles",
      },
    ],
    description:
      "Clear all items provided in 'watchFiles' configuration. Allows to configure list of globs/directories/files to watch for file changes.",
    simpleType: "boolean",
    multiple: false,
  },
  "web-socket-server": {
    configs: [
      {
        description:
          "Deprecated: please use '--web-socket-server-type' option.",
        negatedDescription: "Disallows to set web socket server and options.",
        multiple: false,
        path: "webSocketServer",
        type: "enum",
        values: [false],
      },
      {
        description:
          "Deprecated: please use '--web-socket-server-type' option.",
        multiple: false,
        path: "webSocketServer",
        type: "enum",
        values: ["sockjs", "ws"],
      },
      {
        description:
          "Allows to set web socket server and options (by default 'ws').",
        multiple: false,
        path: "webSocketServer",
        type: "string",
      },
    ],
    description:
      "Deprecated: please use '--web-socket-server-type' option. Allows to set web socket server and options (by default 'ws').",
    simpleType: "string",
    multiple: false,
  },
  "web-socket-server-type": {
    configs: [
      {
        description:
          "Allows to set web socket server and options (by default 'ws').",
        multiple: false,
        path: "webSocketServer.type",
        type: "enum",
        values: ["sockjs", "ws"],
      },
      {
        description:
          "Allows to set web socket server and options (by default 'ws').",
        multiple: false,
        path: "webSocketServer.type",
        type: "string",
      },
    ],
    description:
      "Allows to set web socket server and options (by default 'ws').",
    simpleType: "string",
    multiple: false,
  },
};
