"use strict";

const os = require("os");
const path = require("path");
const url = require("url");
const util = require("util");
const fs = require("graceful-fs");
const ipaddr = require("ipaddr.js");
const { validate } = require("schema-utils");
const schema = require("./options.json");

/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Configuration} WebpackConfiguration */
/** @typedef {import("webpack").StatsOptions} StatsOptions */
/** @typedef {import("webpack").StatsCompilation} StatsCompilation */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("os").NetworkInterfaceInfo} NetworkInterfaceInfo */
/** @typedef {import("express").Request} Request */
/** @typedef {import("express").Response} Response */
/** @typedef {import("express").NextFunction} NextFunction */
/** @typedef {import("express").RequestHandler} ExpressRequestHandler */
/** @typedef {import("express").ErrorRequestHandler} ExpressErrorRequestHandler */
/** @typedef {import("chokidar").WatchOptions} WatchOptions */
/** @typedef {import("chokidar").FSWatcher} FSWatcher */
/** @typedef {import("connect-history-api-fallback").Options} ConnectHistoryApiFallbackOptions */
/** @typedef {import("bonjour-service").Bonjour} Bonjour */
/** @typedef {import("bonjour-service").Service} BonjourOptions */
/** @typedef {import("http-proxy-middleware").RequestHandler} RequestHandler */
/** @typedef {import("http-proxy-middleware").Options} HttpProxyMiddlewareOptions */
/** @typedef {import("http-proxy-middleware").Filter} HttpProxyMiddlewareOptionsFilter */
/** @typedef {import("serve-index").Options} ServeIndexOptions */
/** @typedef {import("serve-static").ServeStaticOptions} ServeStaticOptions */
/** @typedef {import("ipaddr.js").IPv4} IPv4 */
/** @typedef {import("ipaddr.js").IPv6} IPv6 */
/** @typedef {import("net").Socket} Socket */
/** @typedef {import("http").IncomingMessage} IncomingMessage */
/** @typedef {import("open").Options} OpenOptions */

/** @typedef {import("https").ServerOptions & { spdy?: { plain?: boolean | undefined, ssl?: boolean | undefined, 'x-forwarded-for'?: string | undefined, protocol?: string | undefined, protocols?: string[] | undefined }}} ServerOptions */

/**
 * @template Request, Response
 * @typedef {import("webpack-dev-middleware").Options<Request, Response>} DevMiddlewareOptions
 */

/**
 * @template Request, Response
 * @typedef {import("webpack-dev-middleware").Context<Request, Response>} DevMiddlewareContext
 */

/**
 * @typedef {"local-ip" | "local-ipv4" | "local-ipv6" | string} Host
 */

/**
 * @typedef {number | string | "auto"} Port
 */

/**
 * @typedef {Object} WatchFiles
 * @property {string | string[]} paths
 * @property {WatchOptions & { aggregateTimeout?: number, ignored?: WatchOptions["ignored"], poll?: number | boolean }} [options]
 */

/**
 * @typedef {Object} Static
 * @property {string} [directory]
 * @property {string | string[]} [publicPath]
 * @property {boolean | ServeIndexOptions} [serveIndex]
 * @property {ServeStaticOptions} [staticOptions]
 * @property {boolean | WatchOptions & { aggregateTimeout?: number, ignored?: WatchOptions["ignored"], poll?: number | boolean }} [watch]
 */

/**
 * @typedef {Object} NormalizedStatic
 * @property {string} directory
 * @property {string[]} publicPath
 * @property {false | ServeIndexOptions} serveIndex
 * @property {ServeStaticOptions} staticOptions
 * @property {false | WatchOptions} watch
 */

/**
 * @typedef {Object} ServerConfiguration
 * @property {"http" | "https" | "spdy" | string} [type]
 * @property {ServerOptions} [options]
 */

/**
 * @typedef {Object} WebSocketServerConfiguration
 * @property {"sockjs" | "ws" | string | Function} [type]
 * @property {Record<string, any>} [options]
 */

/**
 * @typedef {(import("ws").WebSocket | import("sockjs").Connection & { send: import("ws").WebSocket["send"], terminate: import("ws").WebSocket["terminate"], ping: import("ws").WebSocket["ping"] }) & { isAlive?: boolean }} ClientConnection
 */

/**
 * @typedef {import("ws").WebSocketServer | import("sockjs").Server & { close: import("ws").WebSocketServer["close"] }} WebSocketServer
 */

/**
 * @typedef {{ implementation: WebSocketServer, clients: ClientConnection[] }} WebSocketServerImplementation
 */

/**
 * @callback ByPass
 * @param {Request} req
 * @param {Response} res
 * @param {ProxyConfigArrayItem} proxyConfig
 */

/**
 * @typedef {{ path?: HttpProxyMiddlewareOptionsFilter | undefined, context?: HttpProxyMiddlewareOptionsFilter | undefined } & { bypass?: ByPass } & HttpProxyMiddlewareOptions } ProxyConfigArrayItem
 */

/**
 * @typedef {(ProxyConfigArrayItem | ((req?: Request | undefined, res?: Response | undefined, next?: NextFunction | undefined) => ProxyConfigArrayItem))[]} ProxyConfigArray
 */

/**
 * @typedef {{ [url: string]: string | ProxyConfigArrayItem }} ProxyConfigMap
 */

/**
 * @typedef {Object} OpenApp
 * @property {string} [name]
 * @property {string[]} [arguments]
 */

/**
 * @typedef {Object} Open
 * @property {string | string[] | OpenApp} [app]
 * @property {string | string[]} [target]
 */

/**
 * @typedef {Object} NormalizedOpen
 * @property {string} target
 * @property {import("open").Options} options
 */

/**
 * @typedef {Object} WebSocketURL
 * @property {string} [hostname]
 * @property {string} [password]
 * @property {string} [pathname]
 * @property {number | string} [port]
 * @property {string} [protocol]
 * @property {string} [username]
 */

/**
 * @typedef {boolean | ((error: Error) => void)} OverlayMessageOptions
 */

/**
 * @typedef {Object} ClientConfiguration
 * @property {"log" | "info" | "warn" | "error" | "none" | "verbose"} [logging]
 * @property {boolean  | { warnings?: OverlayMessageOptions, errors?: OverlayMessageOptions, runtimeErrors?: OverlayMessageOptions }} [overlay]
 * @property {boolean} [progress]
 * @property {boolean | number} [reconnect]
 * @property {"ws" | "sockjs" | string} [webSocketTransport]
 * @property {string | WebSocketURL} [webSocketURL]
 */

/**
 * @typedef {Array<{ key: string; value: string }> | Record<string, string | string[]>} Headers
 */

/**
 * @typedef {{ name?: string, path?: string, middleware: ExpressRequestHandler | ExpressErrorRequestHandler } | ExpressRequestHandler | ExpressErrorRequestHandler} Middleware
 */

/**
 * @typedef {Object} Configuration
 * @property {boolean | string} [ipc]
 * @property {Host} [host]
 * @property {Port} [port]
 * @property {boolean | "only"} [hot]
 * @property {boolean} [liveReload]
 * @property {DevMiddlewareOptions<Request, Response>} [devMiddleware]
 * @property {boolean} [compress]
 * @property {boolean} [magicHtml]
 * @property {"auto" | "all" | string | string[]} [allowedHosts]
 * @property {boolean | ConnectHistoryApiFallbackOptions} [historyApiFallback]
 * @property {boolean | Record<string, never> | BonjourOptions} [bonjour]
 * @property {string | string[] | WatchFiles | Array<string | WatchFiles>} [watchFiles]
 * @property {boolean | string | Static | Array<string | Static>} [static]
 * @property {boolean | ServerOptions} [https]
 * @property {boolean} [http2]
 * @property {"http" | "https" | "spdy" | string | ServerConfiguration} [server]
 * @property {boolean | "sockjs" | "ws" | string | WebSocketServerConfiguration} [webSocketServer]
 * @property {ProxyConfigMap | ProxyConfigArrayItem | ProxyConfigArray} [proxy]
 * @property {boolean | string | Open | Array<string | Open>} [open]
 * @property {boolean} [setupExitSignals]
 * @property {boolean | ClientConfiguration} [client]
 * @property {Headers | ((req: Request, res: Response, context: DevMiddlewareContext<Request, Response>) => Headers)} [headers]
 * @property {(devServer: Server) => void} [onAfterSetupMiddleware]
 * @property {(devServer: Server) => void} [onBeforeSetupMiddleware]
 * @property {(devServer: Server) => void} [onListening]
 * @property {(middlewares: Middleware[], devServer: Server) => Middleware[]} [setupMiddlewares]
 */

if (!process.env.WEBPACK_SERVE) {
  // TODO fix me in the next major release
  // @ts-ignore
  process.env.WEBPACK_SERVE = true;
}

/**
 * @template T
 * @param fn {(function(): any) | undefined}
 * @returns {function(): T}
 */
const memoize = (fn) => {
  let cache = false;
  /** @type {T} */
  let result;

  return () => {
    if (cache) {
      return result;
    }

    result = /** @type {function(): any} */ (fn)();
    cache = true;
    // Allow to clean up memory for fn
    // and all dependent resources
    // eslint-disable-next-line no-undefined
    fn = undefined;

    return result;
  };
};

const getExpress = memoize(() => require("express"));

/**
 *
 * @param {OverlayMessageOptions} [setting]
 * @returns
 */
const encodeOverlaySettings = (setting) =>
  typeof setting === "function"
    ? encodeURIComponent(setting.toString())
    : setting;

class Server {
  /**
   * @param {Configuration | Compiler | MultiCompiler} options
   * @param {Compiler | MultiCompiler | Configuration} compiler
   */
  constructor(options = {}, compiler) {
    // TODO: remove this after plugin support is published
    if (/** @type {Compiler | MultiCompiler} */ (options).hooks) {
      util.deprecate(
        () => {},
        "Using 'compiler' as the first argument is deprecated. Please use 'options' as the first argument and 'compiler' as the second argument.",
        "DEP_WEBPACK_DEV_SERVER_CONSTRUCTOR"
      )();

      [options = {}, compiler] = [compiler, options];
    }

    validate(/** @type {Schema} */ (schema), options, {
      name: "Dev Server",
      baseDataPath: "options",
    });

    this.compiler = /** @type {Compiler | MultiCompiler} */ (compiler);
    /**
     * @type {ReturnType<Compiler["getInfrastructureLogger"]>}
     * */
    this.logger = this.compiler.getInfrastructureLogger("webpack-dev-server");
    this.options = /** @type {Configuration} */ (options);
    /**
     * @type {FSWatcher[]}
     */
    this.staticWatchers = [];
    /**
     * @private
     * @type {{ name: string | symbol, listener: (...args: any[]) => void}[] }}
     */
    this.listeners = [];
    // Keep track of websocket proxies for external websocket upgrade.
    /**
     * @private
     * @type {RequestHandler[]}
     */
    this.webSocketProxies = [];
    /**
     * @type {Socket[]}
     */
    this.sockets = [];
    /**
     * @private
     * @type {string | undefined}
     */
    // eslint-disable-next-line no-undefined
    this.currentHash = undefined;
  }

  // TODO compatibility with webpack v4, remove it after drop
  static get cli() {
    return {
      get getArguments() {
        return () => require("../bin/cli-flags");
      },
      get processArguments() {
        return require("../bin/process-arguments");
      },
    };
  }

  static get schema() {
    return schema;
  }

  /**
   * @private
   * @returns {StatsOptions}
   * @constructor
   */
  static get DEFAULT_STATS() {
    return {
      all: false,
      hash: true,
      warnings: true,
      errors: true,
      errorDetails: false,
    };
  }

  /**
   * @param {string} URL
   * @returns {boolean}
   */
  static isAbsoluteURL(URL) {
    // Don't match Windows paths `c:\`
    if (/^[a-zA-Z]:\\/.test(URL)) {
      return false;
    }

    // Scheme: https://tools.ietf.org/html/rfc3986#section-3.1
    // Absolute URL: https://tools.ietf.org/html/rfc3986#section-4.3
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(URL);
  }

  /**
   * @param {string} gateway
   * @returns {string | undefined}
   */
  static findIp(gateway) {
    const gatewayIp = ipaddr.parse(gateway);

    // Look for the matching interface in all local interfaces.
    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const { cidr } of /** @type {NetworkInterfaceInfo[]} */ (
        addresses
      )) {
        const net = ipaddr.parseCIDR(/** @type {string} */ (cidr));

        if (
          net[0] &&
          net[0].kind() === gatewayIp.kind() &&
          gatewayIp.match(net)
        ) {
          return net[0].toString();
        }
      }
    }
  }

  /**
   * @param {"v4" | "v6"} family
   * @returns {Promise<string | undefined>}
   */
  static async internalIP(family) {
    try {
      const { gateway } = await require("default-gateway")[family]();
      return Server.findIp(gateway);
    } catch {
      // ignore
    }
  }

  /**
   * @param {"v4" | "v6"} family
   * @returns {string | undefined}
   */
  static internalIPSync(family) {
    try {
      const { gateway } = require("default-gateway")[family].sync();
      return Server.findIp(gateway);
    } catch {
      // ignore
    }
  }

  /**
   * @param {Host} hostname
   * @returns {Promise<string>}
   */
  static async getHostname(hostname) {
    if (hostname === "local-ip") {
      return (
        (await Server.internalIP("v4")) ||
        (await Server.internalIP("v6")) ||
        "0.0.0.0"
      );
    } else if (hostname === "local-ipv4") {
      return (await Server.internalIP("v4")) || "0.0.0.0";
    } else if (hostname === "local-ipv6") {
      return (await Server.internalIP("v6")) || "::";
    }

    return hostname;
  }

  /**
   * @param {Port} port
   * @param {string} host
   * @returns {Promise<number | string>}
   */
  static async getFreePort(port, host) {
    if (typeof port !== "undefined" && port !== null && port !== "auto") {
      return port;
    }

    const pRetry = require("p-retry");
    const getPort = require("./getPort");
    const basePort =
      typeof process.env.WEBPACK_DEV_SERVER_BASE_PORT !== "undefined"
        ? parseInt(process.env.WEBPACK_DEV_SERVER_BASE_PORT, 10)
        : 8080;

    // Try to find unused port and listen on it for 3 times,
    // if port is not specified in options.
    const defaultPortRetry =
      typeof process.env.WEBPACK_DEV_SERVER_PORT_RETRY !== "undefined"
        ? parseInt(process.env.WEBPACK_DEV_SERVER_PORT_RETRY, 10)
        : 3;

    return pRetry(() => getPort(basePort, host), {
      retries: defaultPortRetry,
    });
  }

  /**
   * @returns {string}
   */
  static findCacheDir() {
    const cwd = process.cwd();

    /**
     * @type {string | undefined}
     */
    let dir = cwd;

    for (;;) {
      try {
        if (fs.statSync(path.join(dir, "package.json")).isFile()) break;
        // eslint-disable-next-line no-empty
      } catch (e) {}

      const parent = path.dirname(dir);

      if (dir === parent) {
        // eslint-disable-next-line no-undefined
        dir = undefined;
        break;
      }

      dir = parent;
    }

    if (!dir) {
      return path.resolve(cwd, ".cache/webpack-dev-server");
    } else if (process.versions.pnp === "1") {
      return path.resolve(dir, ".pnp/.cache/webpack-dev-server");
    } else if (process.versions.pnp === "3") {
      return path.resolve(dir, ".yarn/.cache/webpack-dev-server");
    }

    return path.resolve(dir, "node_modules/.cache/webpack-dev-server");
  }

  /**
   * @private
   * @param {Compiler} compiler
   * @returns bool
   */
  static isWebTarget(compiler) {
    // TODO improve for the next major version - we should store `web` and other targets in `compiler.options.environment`
    if (
      compiler.options.externalsPresets &&
      compiler.options.externalsPresets.web
    ) {
      return true;
    }

    if (
      compiler.options.resolve.conditionNames &&
      compiler.options.resolve.conditionNames.includes("browser")
    ) {
      return true;
    }

    const webTargets = [
      "web",
      "webworker",
      "electron-preload",
      "electron-renderer",
      "node-webkit",
      // eslint-disable-next-line no-undefined
      undefined,
      null,
    ];

    if (Array.isArray(compiler.options.target)) {
      return compiler.options.target.some((r) => webTargets.includes(r));
    }

    return webTargets.includes(/** @type {string} */ (compiler.options.target));
  }

  /**
   * @private
   * @param {Compiler} compiler
   */
  addAdditionalEntries(compiler) {
    /**
     * @type {string[]}
     */
    const additionalEntries = [];
    const isWebTarget = Server.isWebTarget(compiler);

    // TODO maybe empty client
    if (this.options.client && isWebTarget) {
      let webSocketURLStr = "";

      if (this.options.webSocketServer) {
        const webSocketURL =
          /** @type {WebSocketURL} */
          (
            /** @type {ClientConfiguration} */
            (this.options.client).webSocketURL
          );
        const webSocketServer =
          /** @type {{ type: WebSocketServerConfiguration["type"], options: NonNullable<WebSocketServerConfiguration["options"]> }} */
          (this.options.webSocketServer);
        const searchParams = new URLSearchParams();

        /** @type {string} */
        let protocol;

        // We are proxying dev server and need to specify custom `hostname`
        if (typeof webSocketURL.protocol !== "undefined") {
          protocol = webSocketURL.protocol;
        } else {
          protocol =
            /** @type {ServerConfiguration} */
            (this.options.server).type === "http" ? "ws:" : "wss:";
        }

        searchParams.set("protocol", protocol);

        if (typeof webSocketURL.username !== "undefined") {
          searchParams.set("username", webSocketURL.username);
        }

        if (typeof webSocketURL.password !== "undefined") {
          searchParams.set("password", webSocketURL.password);
        }

        /** @type {string} */
        let hostname;

        // SockJS is not supported server mode, so `hostname` and `port` can't specified, let's ignore them
        // TODO show warning about this
        const isSockJSType = webSocketServer.type === "sockjs";

        // We are proxying dev server and need to specify custom `hostname`
        if (typeof webSocketURL.hostname !== "undefined") {
          hostname = webSocketURL.hostname;
        }
        // Web socket server works on custom `hostname`, only for `ws` because `sock-js` is not support custom `hostname`
        else if (
          typeof webSocketServer.options.host !== "undefined" &&
          !isSockJSType
        ) {
          hostname = webSocketServer.options.host;
        }
        // The `host` option is specified
        else if (typeof this.options.host !== "undefined") {
          hostname = this.options.host;
        }
        // The `port` option is not specified
        else {
          hostname = "0.0.0.0";
        }

        searchParams.set("hostname", hostname);

        /** @type {number | string} */
        let port;

        // We are proxying dev server and need to specify custom `port`
        if (typeof webSocketURL.port !== "undefined") {
          port = webSocketURL.port;
        }
        // Web socket server works on custom `port`, only for `ws` because `sock-js` is not support custom `port`
        else if (
          typeof webSocketServer.options.port !== "undefined" &&
          !isSockJSType
        ) {
          port = webSocketServer.options.port;
        }
        // The `port` option is specified
        else if (typeof this.options.port === "number") {
          port = this.options.port;
        }
        // The `port` option is specified using `string`
        else if (
          typeof this.options.port === "string" &&
          this.options.port !== "auto"
        ) {
          port = Number(this.options.port);
        }
        // The `port` option is not specified or set to `auto`
        else {
          port = "0";
        }

        searchParams.set("port", String(port));

        /** @type {string} */
        let pathname = "";

        // We are proxying dev server and need to specify custom `pathname`
        if (typeof webSocketURL.pathname !== "undefined") {
          pathname = webSocketURL.pathname;
        }
        // Web socket server works on custom `path`
        else if (
          typeof webSocketServer.options.prefix !== "undefined" ||
          typeof webSocketServer.options.path !== "undefined"
        ) {
          pathname =
            webSocketServer.options.prefix || webSocketServer.options.path;
        }

        searchParams.set("pathname", pathname);

        const client = /** @type {ClientConfiguration} */ (this.options.client);

        if (typeof client.logging !== "undefined") {
          searchParams.set("logging", client.logging);
        }

        if (typeof client.progress !== "undefined") {
          searchParams.set("progress", String(client.progress));
        }

        if (typeof client.overlay !== "undefined") {
          const overlayString =
            typeof client.overlay === "boolean"
              ? String(client.overlay)
              : JSON.stringify({
                  ...client.overlay,
                  errors: encodeOverlaySettings(client.overlay.errors),
                  warnings: encodeOverlaySettings(client.overlay.warnings),
                  runtimeErrors: encodeOverlaySettings(
                    client.overlay.runtimeErrors
                  ),
                });

          searchParams.set("overlay", overlayString);
        }

        if (typeof client.reconnect !== "undefined") {
          searchParams.set(
            "reconnect",
            typeof client.reconnect === "number"
              ? String(client.reconnect)
              : "10"
          );
        }

        if (typeof this.options.hot !== "undefined") {
          searchParams.set("hot", String(this.options.hot));
        }

        if (typeof this.options.liveReload !== "undefined") {
          searchParams.set("live-reload", String(this.options.liveReload));
        }

        webSocketURLStr = searchParams.toString();
      }

      additionalEntries.push(
        `${require.resolve("../client/index.js")}?${webSocketURLStr}`
      );
    }

    if (this.options.hot === "only") {
      additionalEntries.push(require.resolve("webpack/hot/only-dev-server"));
    } else if (this.options.hot) {
      additionalEntries.push(require.resolve("webpack/hot/dev-server"));
    }

    const webpack = compiler.webpack || require("webpack");

    // use a hook to add entries if available
    if (typeof webpack.EntryPlugin !== "undefined") {
      for (const additionalEntry of additionalEntries) {
        new webpack.EntryPlugin(compiler.context, additionalEntry, {
          // eslint-disable-next-line no-undefined
          name: undefined,
        }).apply(compiler);
      }
    }
    // TODO remove after drop webpack v4 support
    else {
      /**
       * prependEntry Method for webpack 4
       * @param {any} originalEntry
       * @param {any} newAdditionalEntries
       * @returns {any}
       */
      const prependEntry = (originalEntry, newAdditionalEntries) => {
        if (typeof originalEntry === "function") {
          return () =>
            Promise.resolve(originalEntry()).then((entry) =>
              prependEntry(entry, newAdditionalEntries)
            );
        }

        if (
          typeof originalEntry === "object" &&
          !Array.isArray(originalEntry)
        ) {
          /** @type {Object<string,string>} */
          const clone = {};

          Object.keys(originalEntry).forEach((key) => {
            // entry[key] should be a string here
            const entryDescription = originalEntry[key];

            clone[key] = prependEntry(entryDescription, newAdditionalEntries);
          });

          return clone;
        }

        // in this case, entry is a string or an array.
        // make sure that we do not add duplicates.
        /** @type {any} */
        const entriesClone = additionalEntries.slice(0);

        [].concat(originalEntry).forEach((newEntry) => {
          if (!entriesClone.includes(newEntry)) {
            entriesClone.push(newEntry);
          }
        });

        return entriesClone;
      };

      compiler.options.entry = prependEntry(
        compiler.options.entry || "./src",
        additionalEntries
      );
      compiler.hooks.entryOption.call(
        /** @type {string} */ (compiler.options.context),
        compiler.options.entry
      );
    }
  }

  /**
   * @private
   * @returns {Compiler["options"]}
   */
  getCompilerOptions() {
    if (
      typeof (/** @type {MultiCompiler} */ (this.compiler).compilers) !==
      "undefined"
    ) {
      if (/** @type {MultiCompiler} */ (this.compiler).compilers.length === 1) {
        return (
          /** @type {MultiCompiler} */
          (this.compiler).compilers[0].options
        );
      }

      // Configuration with the `devServer` options
      const compilerWithDevServer =
        /** @type {MultiCompiler} */
        (this.compiler).compilers.find((config) => config.options.devServer);

      if (compilerWithDevServer) {
        return compilerWithDevServer.options;
      }

      // Configuration with `web` preset
      const compilerWithWebPreset =
        /** @type {MultiCompiler} */
        (this.compiler).compilers.find(
          (config) =>
            (config.options.externalsPresets &&
              config.options.externalsPresets.web) ||
            [
              "web",
              "webworker",
              "electron-preload",
              "electron-renderer",
              "node-webkit",
              // eslint-disable-next-line no-undefined
              undefined,
              null,
            ].includes(/** @type {string} */ (config.options.target))
        );

      if (compilerWithWebPreset) {
        return compilerWithWebPreset.options;
      }

      // Fallback
      return /** @type {MultiCompiler} */ (this.compiler).compilers[0].options;
    }

    return /** @type {Compiler} */ (this.compiler).options;
  }

  /**
   * @private
   * @returns {Promise<void>}
   */
  async normalizeOptions() {
    const { options } = this;
    const compilerOptions = this.getCompilerOptions();
    // TODO remove `{}` after drop webpack v4 support
    const compilerWatchOptions = compilerOptions.watchOptions || {};
    /**
     * @param {WatchOptions & { aggregateTimeout?: number, ignored?: WatchOptions["ignored"], poll?: number | boolean }} watchOptions
     * @returns {WatchOptions}
     */
    const getWatchOptions = (watchOptions = {}) => {
      const getPolling = () => {
        if (typeof watchOptions.usePolling !== "undefined") {
          return watchOptions.usePolling;
        }

        if (typeof watchOptions.poll !== "undefined") {
          return Boolean(watchOptions.poll);
        }

        if (typeof compilerWatchOptions.poll !== "undefined") {
          return Boolean(compilerWatchOptions.poll);
        }

        return false;
      };
      const getInterval = () => {
        if (typeof watchOptions.interval !== "undefined") {
          return watchOptions.interval;
        }

        if (typeof watchOptions.poll === "number") {
          return watchOptions.poll;
        }

        if (typeof compilerWatchOptions.poll === "number") {
          return compilerWatchOptions.poll;
        }
      };

      const usePolling = getPolling();
      const interval = getInterval();
      const { poll, ...rest } = watchOptions;

      return {
        ignoreInitial: true,
        persistent: true,
        followSymlinks: false,
        atomic: false,
        alwaysStat: true,
        ignorePermissionErrors: true,
        // Respect options from compiler watchOptions
        usePolling,
        interval,
        ignored: watchOptions.ignored,
        // TODO: we respect these options for all watch options and allow developers to pass them to chokidar, but chokidar doesn't have these options maybe we need revisit that in future
        ...rest,
      };
    };
    /**
     * @param {string | Static | undefined} [optionsForStatic]
     * @returns {NormalizedStatic}
     */
    const getStaticItem = (optionsForStatic) => {
      const getDefaultStaticOptions = () => {
        return {
          directory: path.join(process.cwd(), "public"),
          staticOptions: {},
          publicPath: ["/"],
          serveIndex: { icons: true },
          watch: getWatchOptions(),
        };
      };

      /** @type {NormalizedStatic} */
      let item;

      if (typeof optionsForStatic === "undefined") {
        item = getDefaultStaticOptions();
      } else if (typeof optionsForStatic === "string") {
        item = {
          ...getDefaultStaticOptions(),
          directory: optionsForStatic,
        };
      } else {
        const def = getDefaultStaticOptions();

        item = {
          directory:
            typeof optionsForStatic.directory !== "undefined"
              ? optionsForStatic.directory
              : def.directory,
          // TODO: do merge in the next major release
          staticOptions:
            typeof optionsForStatic.staticOptions !== "undefined"
              ? optionsForStatic.staticOptions
              : def.staticOptions,
          publicPath:
            // eslint-disable-next-line no-nested-ternary
            typeof optionsForStatic.publicPath !== "undefined"
              ? Array.isArray(optionsForStatic.publicPath)
                ? optionsForStatic.publicPath
                : [optionsForStatic.publicPath]
              : def.publicPath,
          // TODO: do merge in the next major release
          serveIndex:
            // eslint-disable-next-line no-nested-ternary
            typeof optionsForStatic.serveIndex !== "undefined"
              ? typeof optionsForStatic.serveIndex === "boolean" &&
                optionsForStatic.serveIndex
                ? def.serveIndex
                : optionsForStatic.serveIndex
              : def.serveIndex,
          watch:
            // eslint-disable-next-line no-nested-ternary
            typeof optionsForStatic.watch !== "undefined"
              ? // eslint-disable-next-line no-nested-ternary
                typeof optionsForStatic.watch === "boolean"
                ? optionsForStatic.watch
                  ? def.watch
                  : false
                : getWatchOptions(optionsForStatic.watch)
              : def.watch,
        };
      }

      if (Server.isAbsoluteURL(item.directory)) {
        throw new Error("Using a URL as static.directory is not supported");
      }

      return item;
    };

    if (typeof options.allowedHosts === "undefined") {
      // AllowedHosts allows some default hosts picked from `options.host` or `webSocketURL.hostname` and `localhost`
      options.allowedHosts = "auto";
    }
    // We store allowedHosts as array when supplied as string
    else if (
      typeof options.allowedHosts === "string" &&
      options.allowedHosts !== "auto" &&
      options.allowedHosts !== "all"
    ) {
      options.allowedHosts = [options.allowedHosts];
    }
    // CLI pass options as array, we should normalize them
    else if (
      Array.isArray(options.allowedHosts) &&
      options.allowedHosts.includes("all")
    ) {
      options.allowedHosts = "all";
    }

    if (typeof options.bonjour === "undefined") {
      options.bonjour = false;
    } else if (typeof options.bonjour === "boolean") {
      options.bonjour = options.bonjour ? {} : false;
    }

    if (
      typeof options.client === "undefined" ||
      (typeof options.client === "object" && options.client !== null)
    ) {
      if (!options.client) {
        options.client = {};
      }

      if (typeof options.client.webSocketURL === "undefined") {
        options.client.webSocketURL = {};
      } else if (typeof options.client.webSocketURL === "string") {
        const parsedURL = new URL(options.client.webSocketURL);

        options.client.webSocketURL = {
          protocol: parsedURL.protocol,
          hostname: parsedURL.hostname,
          port: parsedURL.port.length > 0 ? Number(parsedURL.port) : "",
          pathname: parsedURL.pathname,
          username: parsedURL.username,
          password: parsedURL.password,
        };
      } else if (typeof options.client.webSocketURL.port === "string") {
        options.client.webSocketURL.port = Number(
          options.client.webSocketURL.port
        );
      }

      // Enable client overlay by default
      if (typeof options.client.overlay === "undefined") {
        options.client.overlay = true;
      } else if (typeof options.client.overlay !== "boolean") {
        options.client.overlay = {
          errors: true,
          warnings: true,
          ...options.client.overlay,
        };
      }

      if (typeof options.client.reconnect === "undefined") {
        options.client.reconnect = 10;
      } else if (options.client.reconnect === true) {
        options.client.reconnect = Infinity;
      } else if (options.client.reconnect === false) {
        options.client.reconnect = 0;
      }

      // Respect infrastructureLogging.level
      if (typeof options.client.logging === "undefined") {
        options.client.logging = compilerOptions.infrastructureLogging
          ? compilerOptions.infrastructureLogging.level
          : "info";
      }
    }

    if (typeof options.compress === "undefined") {
      options.compress = true;
    }

    if (typeof options.devMiddleware === "undefined") {
      options.devMiddleware = {};
    }

    // No need to normalize `headers`

    if (typeof options.historyApiFallback === "undefined") {
      options.historyApiFallback = false;
    } else if (
      typeof options.historyApiFallback === "boolean" &&
      options.historyApiFallback
    ) {
      options.historyApiFallback = {};
    }

    // No need to normalize `host`

    options.hot =
      typeof options.hot === "boolean" || options.hot === "only"
        ? options.hot
        : true;

    const isHTTPs = Boolean(options.https);
    const isSPDY = Boolean(options.http2);

    if (isHTTPs) {
      // TODO: remove in the next major release
      util.deprecate(
        () => {},
        "'https' option is deprecated. Please use the 'server' option.",
        "DEP_WEBPACK_DEV_SERVER_HTTPS"
      )();
    }

    if (isSPDY) {
      // TODO: remove in the next major release
      util.deprecate(
        () => {},
        "'http2' option is deprecated. Please use the 'server' option.",
        "DEP_WEBPACK_DEV_SERVER_HTTP2"
      )();
    }

    options.server = {
      type:
        // eslint-disable-next-line no-nested-ternary
        typeof options.server === "string"
          ? options.server
          : // eslint-disable-next-line no-nested-ternary
          typeof (options.server || {}).type === "string"
          ? /** @type {ServerConfiguration} */ (options.server).type || "http"
          : // eslint-disable-next-line no-nested-ternary
          isSPDY
          ? "spdy"
          : isHTTPs
          ? "https"
          : "http",
      options: {
        .../** @type {ServerOptions} */ (options.https),
        .../** @type {ServerConfiguration} */ (options.server || {}).options,
      },
    };

    if (
      options.server.type === "spdy" &&
      typeof (/** @type {ServerOptions} */ (options.server.options).spdy) ===
        "undefined"
    ) {
      /** @type {ServerOptions} */
      (options.server.options).spdy = {
        protocols: ["h2", "http/1.1"],
      };
    }

    if (options.server.type === "https" || options.server.type === "spdy") {
      if (
        typeof (
          /** @type {ServerOptions} */ (options.server.options).requestCert
        ) === "undefined"
      ) {
        /** @type {ServerOptions} */
        (options.server.options).requestCert = false;
      }

      const httpsProperties =
        /** @type {Array<keyof ServerOptions>} */
        (["cacert", "ca", "cert", "crl", "key", "pfx"]);

      for (const property of httpsProperties) {
        if (
          typeof (
            /** @type {ServerOptions} */ (options.server.options)[property]
          ) === "undefined"
        ) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // @ts-ignore
        if (property === "cacert") {
          // TODO remove the `cacert` option in favor `ca` in the next major release
          util.deprecate(
            () => {},
            "The 'cacert' option is deprecated. Please use the 'ca' option.",
            "DEP_WEBPACK_DEV_SERVER_CACERT"
          )();
        }

        /** @type {any} */
        const value =
          /** @type {ServerOptions} */
          (options.server.options)[property];
        /**
         * @param {string | Buffer | undefined} item
         * @returns {string | Buffer | undefined}
         */
        const readFile = (item) => {
          if (
            Buffer.isBuffer(item) ||
            (typeof item === "object" && item !== null && !Array.isArray(item))
          ) {
            return item;
          }

          if (item) {
            let stats = null;

            try {
              stats = fs.lstatSync(fs.realpathSync(item)).isFile();
            } catch (error) {
              // Ignore error
            }

            // It is a file
            return stats ? fs.readFileSync(item) : item;
          }
        };

        /** @type {any} */
        (options.server.options)[property] = Array.isArray(value)
          ? value.map((item) => readFile(item))
          : readFile(value);
      }

      let fakeCert;

      if (
        !(/** @type {ServerOptions} */ (options.server.options).key) ||
        !(/** @type {ServerOptions} */ (options.server.options).cert)
      ) {
        const certificateDir = Server.findCacheDir();
        const certificatePath = path.join(certificateDir, "server.pem");
        let certificateExists;

        try {
          const certificate = await fs.promises.stat(certificatePath);
          certificateExists = certificate.isFile();
        } catch {
          certificateExists = false;
        }

        if (certificateExists) {
          const certificateTtl = 1000 * 60 * 60 * 24;
          const certificateStat = await fs.promises.stat(certificatePath);
          const now = Number(new Date());

          // cert is more than 30 days old, kill it with fire
          if ((now - Number(certificateStat.ctime)) / certificateTtl > 30) {
            const { promisify } = require("util");
            const rimraf = require("rimraf");
            const del = promisify(rimraf);

            this.logger.info(
              "SSL certificate is more than 30 days old. Removing..."
            );

            await del(certificatePath);

            certificateExists = false;
          }
        }

        if (!certificateExists) {
          this.logger.info("Generating SSL certificate...");

          // @ts-ignore
          const selfsigned = require("selfsigned");
          const attributes = [{ name: "commonName", value: "localhost" }];
          const pems = selfsigned.generate(attributes, {
            algorithm: "sha256",
            days: 30,
            keySize: 2048,
            extensions: [
              {
                name: "basicConstraints",
                cA: true,
              },
              {
                name: "keyUsage",
                keyCertSign: true,
                digitalSignature: true,
                nonRepudiation: true,
                keyEncipherment: true,
                dataEncipherment: true,
              },
              {
                name: "extKeyUsage",
                serverAuth: true,
                clientAuth: true,
                codeSigning: true,
                timeStamping: true,
              },
              {
                name: "subjectAltName",
                altNames: [
                  {
                    // type 2 is DNS
                    type: 2,
                    value: "localhost",
                  },
                  {
                    type: 2,
                    value: "localhost.localdomain",
                  },
                  {
                    type: 2,
                    value: "lvh.me",
                  },
                  {
                    type: 2,
                    value: "*.lvh.me",
                  },
                  {
                    type: 2,
                    value: "[::1]",
                  },
                  {
                    // type 7 is IP
                    type: 7,
                    ip: "127.0.0.1",
                  },
                  {
                    type: 7,
                    ip: "fe80::1",
                  },
                ],
              },
            ],
          });

          await fs.promises.mkdir(certificateDir, { recursive: true });

          await fs.promises.writeFile(
            certificatePath,
            pems.private + pems.cert,
            {
              encoding: "utf8",
            }
          );
        }

        fakeCert = await fs.promises.readFile(certificatePath);

        this.logger.info(`SSL certificate: ${certificatePath}`);
      }

      if (
        /** @type {ServerOptions & { cacert?: ServerOptions["ca"] }} */ (
          options.server.options
        ).cacert
      ) {
        if (/** @type {ServerOptions} */ (options.server.options).ca) {
          this.logger.warn(
            "Do not specify 'ca' and 'cacert' options together, the 'ca' option will be used."
          );
        } else {
          /** @type {ServerOptions} */
          (options.server.options).ca =
            /** @type {ServerOptions & { cacert?: ServerOptions["ca"] }} */
            (options.server.options).cacert;
        }

        delete (
          /** @type {ServerOptions & { cacert?: ServerOptions["ca"] }} */ (
            options.server.options
          ).cacert
        );
      }

      /** @type {ServerOptions} */
      (options.server.options).key =
        /** @type {ServerOptions} */
        (options.server.options).key || fakeCert;
      /** @type {ServerOptions} */
      (options.server.options).cert =
        /** @type {ServerOptions} */
        (options.server.options).cert || fakeCert;
    }

    if (typeof options.ipc === "boolean") {
      const isWindows = process.platform === "win32";
      const pipePrefix = isWindows ? "\\\\.\\pipe\\" : os.tmpdir();
      const pipeName = "webpack-dev-server.sock";

      options.ipc = path.join(pipePrefix, pipeName);
    }

    options.liveReload =
      typeof options.liveReload !== "undefined" ? options.liveReload : true;

    options.magicHtml =
      typeof options.magicHtml !== "undefined" ? options.magicHtml : true;

    // https://github.com/webpack/webpack-dev-server/issues/1990
    const defaultOpenOptions = { wait: false };
    /**
     * @param {any} target
     * @returns {NormalizedOpen[]}
     */
    // TODO: remove --open-app in favor of --open-app-name
    const getOpenItemsFromObject = ({ target, ...rest }) => {
      const normalizedOptions = { ...defaultOpenOptions, ...rest };

      if (typeof normalizedOptions.app === "string") {
        normalizedOptions.app = {
          name: normalizedOptions.app,
        };
      }

      const normalizedTarget = typeof target === "undefined" ? "<url>" : target;

      if (Array.isArray(normalizedTarget)) {
        return normalizedTarget.map((singleTarget) => {
          return { target: singleTarget, options: normalizedOptions };
        });
      }

      return [{ target: normalizedTarget, options: normalizedOptions }];
    };

    if (typeof options.open === "undefined") {
      /** @type {NormalizedOpen[]} */
      (options.open) = [];
    } else if (typeof options.open === "boolean") {
      /** @type {NormalizedOpen[]} */
      (options.open) = options.open
        ? [
            {
              target: "<url>",
              options: /** @type {OpenOptions} */ (defaultOpenOptions),
            },
          ]
        : [];
    } else if (typeof options.open === "string") {
      /** @type {NormalizedOpen[]} */
      (options.open) = [{ target: options.open, options: defaultOpenOptions }];
    } else if (Array.isArray(options.open)) {
      /**
       * @type {NormalizedOpen[]}
       */
      const result = [];

      options.open.forEach((item) => {
        if (typeof item === "string") {
          result.push({ target: item, options: defaultOpenOptions });

          return;
        }

        result.push(...getOpenItemsFromObject(item));
      });

      /** @type {NormalizedOpen[]} */
      (options.open) = result;
    } else {
      /** @type {NormalizedOpen[]} */
      (options.open) = [...getOpenItemsFromObject(options.open)];
    }

    if (options.onAfterSetupMiddleware) {
      // TODO: remove in the next major release
      util.deprecate(
        () => {},
        "'onAfterSetupMiddleware' option is deprecated. Please use the 'setupMiddlewares' option.",
        `DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE`
      )();
    }

    if (options.onBeforeSetupMiddleware) {
      // TODO: remove in the next major release
      util.deprecate(
        () => {},
        "'onBeforeSetupMiddleware' option is deprecated. Please use the 'setupMiddlewares' option.",
        `DEP_WEBPACK_DEV_SERVER_ON_BEFORE_SETUP_MIDDLEWARE`
      )();
    }

    if (typeof options.port === "string" && options.port !== "auto") {
      options.port = Number(options.port);
    }

    /**
     * Assume a proxy configuration specified as:
     * proxy: {
     *   'context': { options }
     * }
     * OR
     * proxy: {
     *   'context': 'target'
     * }
     */
    if (typeof options.proxy !== "undefined") {
      // TODO remove in the next major release, only accept `Array`
      if (!Array.isArray(options.proxy)) {
        if (
          Object.prototype.hasOwnProperty.call(options.proxy, "target") ||
          Object.prototype.hasOwnProperty.call(options.proxy, "router")
        ) {
          /** @type {ProxyConfigArray} */
          (options.proxy) = [/** @type {ProxyConfigMap} */ (options.proxy)];
        } else {
          /** @type {ProxyConfigArray} */
          (options.proxy) = Object.keys(options.proxy).map(
            /**
             * @param {string} context
             * @returns {HttpProxyMiddlewareOptions}
             */
            (context) => {
              let proxyOptions;
              // For backwards compatibility reasons.
              const correctedContext = context
                .replace(/^\*$/, "**")
                .replace(/\/\*$/, "");

              if (
                typeof (
                  /** @type {ProxyConfigMap} */ (options.proxy)[context]
                ) === "string"
              ) {
                proxyOptions = {
                  context: correctedContext,
                  target:
                    /** @type {ProxyConfigMap} */
                    (options.proxy)[context],
                };
              } else {
                proxyOptions = {
                  // @ts-ignore
                  .../** @type {ProxyConfigMap} */ (options.proxy)[context],
                };
                proxyOptions.context = correctedContext;
              }

              return proxyOptions;
            }
          );
        }
      }

      /** @type {ProxyConfigArray} */
      (options.proxy) =
        /** @type {ProxyConfigArray} */
        (options.proxy).map((item) => {
          if (typeof item === "function") {
            return item;
          }

          /**
           * @param {"info" | "warn" | "error" | "debug" | "silent" | undefined | "none" | "log" | "verbose"} level
           * @returns {"info" | "warn" | "error" | "debug" | "silent" | undefined}
           */
          const getLogLevelForProxy = (level) => {
            if (level === "none") {
              return "silent";
            }

            if (level === "log") {
              return "info";
            }

            if (level === "verbose") {
              return "debug";
            }

            return level;
          };

          if (typeof item.logLevel === "undefined") {
            item.logLevel = getLogLevelForProxy(
              compilerOptions.infrastructureLogging
                ? compilerOptions.infrastructureLogging.level
                : "info"
            );
          }

          if (typeof item.logProvider === "undefined") {
            item.logProvider = () => this.logger;
          }

          return item;
        });
    }

    if (typeof options.setupExitSignals === "undefined") {
      options.setupExitSignals = true;
    }

    if (typeof options.static === "undefined") {
      options.static = [getStaticItem()];
    } else if (typeof options.static === "boolean") {
      options.static = options.static ? [getStaticItem()] : false;
    } else if (typeof options.static === "string") {
      options.static = [getStaticItem(options.static)];
    } else if (Array.isArray(options.static)) {
      options.static = options.static.map((item) => getStaticItem(item));
    } else {
      options.static = [getStaticItem(options.static)];
    }

    if (typeof options.watchFiles === "string") {
      options.watchFiles = [
        { paths: options.watchFiles, options: getWatchOptions() },
      ];
    } else if (
      typeof options.watchFiles === "object" &&
      options.watchFiles !== null &&
      !Array.isArray(options.watchFiles)
    ) {
      options.watchFiles = [
        {
          paths: options.watchFiles.paths,
          options: getWatchOptions(options.watchFiles.options || {}),
        },
      ];
    } else if (Array.isArray(options.watchFiles)) {
      options.watchFiles = options.watchFiles.map((item) => {
        if (typeof item === "string") {
          return { paths: item, options: getWatchOptions() };
        }

        return {
          paths: item.paths,
          options: getWatchOptions(item.options || {}),
        };
      });
    } else {
      options.watchFiles = [];
    }

    const defaultWebSocketServerType = "ws";
    const defaultWebSocketServerOptions = { path: "/ws" };

    if (typeof options.webSocketServer === "undefined") {
      options.webSocketServer = {
        type: defaultWebSocketServerType,
        options: defaultWebSocketServerOptions,
      };
    } else if (
      typeof options.webSocketServer === "boolean" &&
      !options.webSocketServer
    ) {
      options.webSocketServer = false;
    } else if (
      typeof options.webSocketServer === "string" ||
      typeof options.webSocketServer === "function"
    ) {
      options.webSocketServer = {
        type: options.webSocketServer,
        options: defaultWebSocketServerOptions,
      };
    } else {
      options.webSocketServer = {
        type:
          /** @type {WebSocketServerConfiguration} */
          (options.webSocketServer).type || defaultWebSocketServerType,
        options: {
          ...defaultWebSocketServerOptions,
          .../** @type {WebSocketServerConfiguration} */
          (options.webSocketServer).options,
        },
      };

      const webSocketServer =
        /** @type {{ type: WebSocketServerConfiguration["type"], options: NonNullable<WebSocketServerConfiguration["options"]> }} */
        (options.webSocketServer);

      if (typeof webSocketServer.options.port === "string") {
        webSocketServer.options.port = Number(webSocketServer.options.port);
      }
    }
  }

  /**
   * @private
   * @returns {string}
   */
  getClientTransport() {
    let clientImplementation;
    let clientImplementationFound = true;

    const isKnownWebSocketServerImplementation =
      this.options.webSocketServer &&
      typeof (
        /** @type {WebSocketServerConfiguration} */
        (this.options.webSocketServer).type
      ) === "string" &&
      // @ts-ignore
      (this.options.webSocketServer.type === "ws" ||
        /** @type {WebSocketServerConfiguration} */
        (this.options.webSocketServer).type === "sockjs");

    let clientTransport;

    if (this.options.client) {
      if (
        typeof (
          /** @type {ClientConfiguration} */
          (this.options.client).webSocketTransport
        ) !== "undefined"
      ) {
        clientTransport =
          /** @type {ClientConfiguration} */
          (this.options.client).webSocketTransport;
      } else if (isKnownWebSocketServerImplementation) {
        clientTransport =
          /** @type {WebSocketServerConfiguration} */
          (this.options.webSocketServer).type;
      } else {
        clientTransport = "ws";
      }
    } else {
      clientTransport = "ws";
    }

    switch (typeof clientTransport) {
      case "string":
        // could be 'sockjs', 'ws', or a path that should be required
        if (clientTransport === "sockjs") {
          clientImplementation = require.resolve(
            "../client/clients/SockJSClient"
          );
        } else if (clientTransport === "ws") {
          clientImplementation = require.resolve(
            "../client/clients/WebSocketClient"
          );
        } else {
          try {
            clientImplementation = require.resolve(clientTransport);
          } catch (e) {
            clientImplementationFound = false;
          }
        }
        break;
      default:
        clientImplementationFound = false;
    }

    if (!clientImplementationFound) {
      throw new Error(
        `${
          !isKnownWebSocketServerImplementation
            ? "When you use custom web socket implementation you must explicitly specify client.webSocketTransport. "
            : ""
        }client.webSocketTransport must be a string denoting a default implementation (e.g. 'sockjs', 'ws') or a full path to a JS file via require.resolve(...) which exports a class `
      );
    }

    return /** @type {string} */ (clientImplementation);
  }

  /**
   * @private
   * @returns {string}
   */
  getServerTransport() {
    let implementation;
    let implementationFound = true;

    switch (
      typeof (
        /** @type {WebSocketServerConfiguration} */
        (this.options.webSocketServer).type
      )
    ) {
      case "string":
        // Could be 'sockjs', in the future 'ws', or a path that should be required
        if (
          /** @type {WebSocketServerConfiguration} */ (
            this.options.webSocketServer
          ).type === "sockjs"
        ) {
          implementation = require("./servers/SockJSServer");
        } else if (
          /** @type {WebSocketServerConfiguration} */ (
            this.options.webSocketServer
          ).type === "ws"
        ) {
          implementation = require("./servers/WebsocketServer");
        } else {
          try {
            // eslint-disable-next-line import/no-dynamic-require
            implementation = require(/** @type {WebSocketServerConfiguration} */ (
              this.options.webSocketServer
            ).type);
          } catch (error) {
            implementationFound = false;
          }
        }
        break;
      case "function":
        implementation = /** @type {WebSocketServerConfiguration} */ (
          this.options.webSocketServer
        ).type;
        break;
      default:
        implementationFound = false;
    }

    if (!implementationFound) {
      throw new Error(
        "webSocketServer (webSocketServer.type) must be a string denoting a default implementation (e.g. 'ws', 'sockjs'), a full path to " +
          "a JS file which exports a class extending BaseServer (webpack-dev-server/lib/servers/BaseServer.js) " +
          "via require.resolve(...), or the class itself which extends BaseServer"
      );
    }

    return implementation;
  }

  /**
   * @private
   * @returns {void}
   */
  setupProgressPlugin() {
    const { ProgressPlugin } =
      /** @type {MultiCompiler}*/
      (this.compiler).compilers
        ? /** @type {MultiCompiler}*/ (this.compiler).compilers[0].webpack
        : /** @type {Compiler}*/ (this.compiler).webpack ||
          // TODO remove me after drop webpack v4
          require("webpack");

    new ProgressPlugin(
      /**
       * @param {number} percent
       * @param {string} msg
       * @param {string} addInfo
       * @param {string} pluginName
       */
      (percent, msg, addInfo, pluginName) => {
        percent = Math.floor(percent * 100);

        if (percent === 100) {
          msg = "Compilation completed";
        }

        if (addInfo) {
          msg = `${msg} (${addInfo})`;
        }

        if (this.webSocketServer) {
          this.sendMessage(this.webSocketServer.clients, "progress-update", {
            percent,
            msg,
            pluginName,
          });
        }

        if (this.server) {
          this.server.emit("progress-update", { percent, msg, pluginName });
        }
      }
    ).apply(this.compiler);
  }

  /**
   * @private
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.options.webSocketServer) {
      const compilers =
        /** @type {MultiCompiler} */
        (this.compiler).compilers || [this.compiler];

      compilers.forEach((compiler) => {
        this.addAdditionalEntries(compiler);

        const webpack = compiler.webpack || require("webpack");

        new webpack.ProvidePlugin({
          __webpack_dev_server_client__: this.getClientTransport(),
        }).apply(compiler);

        // TODO remove after drop webpack v4 support
        compiler.options.plugins = compiler.options.plugins || [];

        if (this.options.hot) {
          const HMRPluginExists = compiler.options.plugins.find(
            (p) => p.constructor === webpack.HotModuleReplacementPlugin
          );

          if (HMRPluginExists) {
            this.logger.warn(
              `"hot: true" automatically applies HMR plugin, you don't have to add it manually to your webpack configuration.`
            );
          } else {
            // Apply the HMR plugin
            const plugin = new webpack.HotModuleReplacementPlugin();

            plugin.apply(compiler);
          }
        }
      });

      if (
        this.options.client &&
        /** @type {ClientConfiguration} */ (this.options.client).progress
      ) {
        this.setupProgressPlugin();
      }
    }

    this.setupHooks();
    this.setupApp();
    this.setupHostHeaderCheck();
    this.setupDevMiddleware();
    // Should be after `webpack-dev-middleware`, otherwise other middlewares might rewrite response
    this.setupBuiltInRoutes();
    this.setupWatchFiles();
    this.setupWatchStaticFiles();
    this.setupMiddlewares();
    this.createServer();

    if (this.options.setupExitSignals) {
      const signals = ["SIGINT", "SIGTERM"];

      let needForceShutdown = false;

      signals.forEach((signal) => {
        const listener = () => {
          if (needForceShutdown) {
            process.exit();
          }

          this.logger.info(
            "Gracefully shutting down. To force exit, press ^C again. Please wait..."
          );

          needForceShutdown = true;

          this.stopCallback(() => {
            if (typeof this.compiler.close === "function") {
              this.compiler.close(() => {
                process.exit();
              });
            } else {
              process.exit();
            }
          });
        };

        this.listeners.push({ name: signal, listener });

        process.on(signal, listener);
      });
    }

    // Proxy WebSocket without the initial http request
    // https://github.com/chimurai/http-proxy-middleware#external-websocket-upgrade
    /** @type {RequestHandler[]} */
    (this.webSocketProxies).forEach((webSocketProxy) => {
      /** @type {import("http").Server} */
      (this.server).on(
        "upgrade",
        /** @type {RequestHandler & { upgrade: NonNullable<RequestHandler["upgrade"]> }} */
        (webSocketProxy).upgrade
      );
    }, this);
  }

  /**
   * @private
   * @returns {void}
   */
  setupApp() {
    /** @type {import("express").Application | undefined}*/
    this.app = new /** @type {any} */ (getExpress())();
  }

  /**
   * @private
   * @param {Stats | MultiStats} statsObj
   * @returns {StatsCompilation}
   */
  getStats(statsObj) {
    const stats = Server.DEFAULT_STATS;
    const compilerOptions = this.getCompilerOptions();

    // @ts-ignore
    if (compilerOptions.stats && compilerOptions.stats.warningsFilter) {
      // @ts-ignore
      stats.warningsFilter = compilerOptions.stats.warningsFilter;
    }

    return statsObj.toJson(stats);
  }

  /**
   * @private
   * @returns {void}
   */
  setupHooks() {
    this.compiler.hooks.invalid.tap("webpack-dev-server", () => {
      if (this.webSocketServer) {
        this.sendMessage(this.webSocketServer.clients, "invalid");
      }
    });
    this.compiler.hooks.done.tap(
      "webpack-dev-server",
      /**
       * @param {Stats | MultiStats} stats
       */
      (stats) => {
        if (this.webSocketServer) {
          this.sendStats(this.webSocketServer.clients, this.getStats(stats));
        }

        /**
         * @private
         * @type {Stats | MultiStats}
         */
        this.stats = stats;
      }
    );
  }

  /**
   * @private
   * @returns {void}
   */
  setupHostHeaderCheck() {
    /** @type {import("express").Application} */
    (this.app).all(
      "*",
      /**
       * @param {Request} req
       * @param {Response} res
       * @param {NextFunction} next
       * @returns {void}
       */
      (req, res, next) => {
        if (
          this.checkHeader(
            /** @type {{ [key: string]: string | undefined }} */
            (req.headers),
            "host"
          )
        ) {
          return next();
        }

        res.send("Invalid Host header");
      }
    );
  }

  /**
   * @private
   * @returns {void}
   */
  setupDevMiddleware() {
    const webpackDevMiddleware = require("webpack-dev-middleware");

    // middleware for serving webpack bundle
    this.middleware = webpackDevMiddleware(
      this.compiler,
      this.options.devMiddleware
    );
  }

  /**
   * @private
   * @returns {void}
   */
  setupBuiltInRoutes() {
    const { app, middleware } = this;

    /** @type {import("express").Application} */
    (app).get(
      "/__webpack_dev_server__/sockjs.bundle.js",
      /**
       * @param {Request} req
       * @param {Response} res
       * @returns {void}
       */
      (req, res) => {
        res.setHeader("Content-Type", "application/javascript");

        const clientPath = path.join(__dirname, "..", "client");

        res.sendFile(path.join(clientPath, "modules/sockjs-client/index.js"));
      }
    );

    /** @type {import("express").Application} */
    (app).get(
      "/webpack-dev-server/invalidate",
      /**
       * @param {Request} _req
       * @param {Response} res
       * @returns {void}
       */
      (_req, res) => {
        this.invalidate();

        res.end();
      }
    );

    /** @type {import("express").Application} */
    (app).get("/webpack-dev-server/open-editor", (req, res) => {
      const fileName = req.query.fileName;

      if (typeof fileName === "string") {
        // @ts-ignore
        const launchEditor = require("launch-editor");
        launchEditor(fileName);
      }

      res.end();
    });

    /** @type {import("express").Application} */
    (app).get(
      "/webpack-dev-server",
      /**
       * @param {Request} req
       * @param {Response} res
       * @returns {void}
       */
      (req, res) => {
        /** @type {import("webpack-dev-middleware").API<Request, Response>}*/
        (middleware).waitUntilValid((stats) => {
          res.setHeader("Content-Type", "text/html");
          res.write(
            '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>'
          );

          const statsForPrint =
            typeof (/** @type {MultiStats} */ (stats).stats) !== "undefined"
              ? /** @type {MultiStats} */ (stats).toJson().children
              : [/** @type {Stats} */ (stats).toJson()];

          res.write(`<h1>Assets Report:</h1>`);

          /**
           * @type {StatsCompilation[]}
           */
          (statsForPrint).forEach((item, index) => {
            res.write("<div>");

            const name =
              // eslint-disable-next-line no-nested-ternary
              typeof item.name !== "undefined"
                ? item.name
                : /** @type {MultiStats} */ (stats).stats
                ? `unnamed[${index}]`
                : "unnamed";

            res.write(`<h2>Compilation: ${name}</h2>`);
            res.write("<ul>");

            const publicPath =
              item.publicPath === "auto" ? "" : item.publicPath;

            for (const asset of /** @type {NonNullable<StatsCompilation["assets"]>} */ (
              item.assets
            )) {
              const assetName = asset.name;
              const assetURL = `${publicPath}${assetName}`;

              res.write(
                `<li>
              <strong><a href="${assetURL}" target="_blank">${assetName}</a></strong>
            </li>`
              );
            }

            res.write("</ul>");
            res.write("</div>");
          });

          res.end("</body></html>");
        });
      }
    );
  }

  /**
   * @private
   * @returns {void}
   */
  setupWatchStaticFiles() {
    if (/** @type {NormalizedStatic[]} */ (this.options.static).length > 0) {
      /** @type {NormalizedStatic[]} */
      (this.options.static).forEach((staticOption) => {
        if (staticOption.watch) {
          this.watchFiles(staticOption.directory, staticOption.watch);
        }
      });
    }
  }

  /**
   * @private
   * @returns {void}
   */
  setupWatchFiles() {
    const { watchFiles } = this.options;

    if (/** @type {WatchFiles[]} */ (watchFiles).length > 0) {
      /** @type {WatchFiles[]} */
      (watchFiles).forEach((item) => {
        this.watchFiles(item.paths, item.options);
      });
    }
  }

  /**
   * @private
   * @returns {void}
   */
  setupMiddlewares() {
    /**
     * @type {Array<Middleware>}
     */
    let middlewares = [];

    // compress is placed last and uses unshift so that it will be the first middleware used
    if (this.options.compress) {
      const compression = require("compression");

      middlewares.push({ name: "compression", middleware: compression() });
    }

    if (typeof this.options.onBeforeSetupMiddleware === "function") {
      this.options.onBeforeSetupMiddleware(this);
    }

    if (typeof this.options.headers !== "undefined") {
      middlewares.push({
        name: "set-headers",
        path: "*",
        middleware: this.setHeaders.bind(this),
      });
    }

    middlewares.push({
      name: "webpack-dev-middleware",
      middleware:
        /** @type {import("webpack-dev-middleware").Middleware<Request, Response>}*/
        (this.middleware),
    });

    if (this.options.proxy) {
      const { createProxyMiddleware } = require("http-proxy-middleware");

      /**
       * @param {ProxyConfigArrayItem} proxyConfig
       * @returns {RequestHandler | undefined}
       */
      const getProxyMiddleware = (proxyConfig) => {
        // It is possible to use the `bypass` method without a `target` or `router`.
        // However, the proxy middleware has no use in this case, and will fail to instantiate.
        if (proxyConfig.target) {
          const context = proxyConfig.context || proxyConfig.path;

          return createProxyMiddleware(
            /** @type {string} */ (context),
            proxyConfig
          );
        }

        if (proxyConfig.router) {
          return createProxyMiddleware(proxyConfig);
        }
      };

      /**
       * Assume a proxy configuration specified as:
       * proxy: [
       *   {
       *     context: "value",
       *     ...options,
       *   },
       *   // or:
       *   function() {
       *     return {
       *       context: "context",
       *       ...options,
       *     };
       *   }
       * ]
       */
      /** @type {ProxyConfigArray} */
      (this.options.proxy).forEach((proxyConfigOrCallback) => {
        /**
         * @type {RequestHandler}
         */
        let proxyMiddleware;

        let proxyConfig =
          typeof proxyConfigOrCallback === "function"
            ? proxyConfigOrCallback()
            : proxyConfigOrCallback;

        proxyMiddleware =
          /** @type {RequestHandler} */
          (getProxyMiddleware(proxyConfig));

        if (proxyConfig.ws) {
          this.webSocketProxies.push(proxyMiddleware);
        }

        /**
         * @param {Request} req
         * @param {Response} res
         * @param {NextFunction} next
         * @returns {Promise<void>}
         */
        const handler = async (req, res, next) => {
          if (typeof proxyConfigOrCallback === "function") {
            const newProxyConfig = proxyConfigOrCallback(req, res, next);

            if (newProxyConfig !== proxyConfig) {
              proxyConfig = newProxyConfig;
              proxyMiddleware =
                /** @type {RequestHandler} */
                (getProxyMiddleware(proxyConfig));
            }
          }

          // - Check if we have a bypass function defined
          // - In case the bypass function is defined we'll retrieve the
          // bypassUrl from it otherwise bypassUrl would be null
          // TODO remove in the next major in favor `context` and `router` options
          const isByPassFuncDefined = typeof proxyConfig.bypass === "function";
          const bypassUrl = isByPassFuncDefined
            ? await /** @type {ByPass} */ (proxyConfig.bypass)(
                req,
                res,
                proxyConfig
              )
            : null;

          if (typeof bypassUrl === "boolean") {
            // skip the proxy
            // @ts-ignore
            req.url = null;
            next();
          } else if (typeof bypassUrl === "string") {
            // byPass to that url
            req.url = bypassUrl;
            next();
          } else if (proxyMiddleware) {
            return proxyMiddleware(req, res, next);
          } else {
            next();
          }
        };

        middlewares.push({
          name: "http-proxy-middleware",
          middleware: handler,
        });
        // Also forward error requests to the proxy so it can handle them.
        middlewares.push({
          name: "http-proxy-middleware-error-handler",
          middleware:
            /**
             * @param {Error} error
             * @param {Request} req
             * @param {Response} res
             * @param {NextFunction} next
             * @returns {any}
             */
            (error, req, res, next) => handler(req, res, next),
        });
      });

      middlewares.push({
        name: "webpack-dev-middleware",
        middleware:
          /** @type {import("webpack-dev-middleware").Middleware<Request, Response>}*/
          (this.middleware),
      });
    }

    if (/** @type {NormalizedStatic[]} */ (this.options.static).length > 0) {
      /** @type {NormalizedStatic[]} */
      (this.options.static).forEach((staticOption) => {
        staticOption.publicPath.forEach((publicPath) => {
          middlewares.push({
            name: "express-static",
            path: publicPath,
            middleware: getExpress().static(
              staticOption.directory,
              staticOption.staticOptions
            ),
          });
        });
      });
    }

    if (this.options.historyApiFallback) {
      const connectHistoryApiFallback = require("connect-history-api-fallback");
      const { historyApiFallback } = this.options;

      if (
        typeof (
          /** @type {ConnectHistoryApiFallbackOptions} */
          (historyApiFallback).logger
        ) === "undefined" &&
        !(
          /** @type {ConnectHistoryApiFallbackOptions} */
          (historyApiFallback).verbose
        )
      ) {
        // @ts-ignore
        historyApiFallback.logger = this.logger.log.bind(
          this.logger,
          "[connect-history-api-fallback]"
        );
      }

      // Fall back to /index.html if nothing else matches.
      middlewares.push({
        name: "connect-history-api-fallback",
        middleware: connectHistoryApiFallback(
          /** @type {ConnectHistoryApiFallbackOptions} */
          (historyApiFallback)
        ),
      });

      // include our middleware to ensure
      // it is able to handle '/index.html' request after redirect
      middlewares.push({
        name: "webpack-dev-middleware",
        middleware:
          /** @type {import("webpack-dev-middleware").Middleware<Request, Response>}*/
          (this.middleware),
      });

      if (/** @type {NormalizedStatic[]} */ (this.options.static).length > 0) {
        /** @type {NormalizedStatic[]} */
        (this.options.static).forEach((staticOption) => {
          staticOption.publicPath.forEach((publicPath) => {
            middlewares.push({
              name: "express-static",
              path: publicPath,
              middleware: getExpress().static(
                staticOption.directory,
                staticOption.staticOptions
              ),
            });
          });
        });
      }
    }

    if (/** @type {NormalizedStatic[]} */ (this.options.static).length > 0) {
      const serveIndex = require("serve-index");

      /** @type {NormalizedStatic[]} */
      (this.options.static).forEach((staticOption) => {
        staticOption.publicPath.forEach((publicPath) => {
          if (staticOption.serveIndex) {
            middlewares.push({
              name: "serve-index",
              path: publicPath,
              /**
               * @param {Request} req
               * @param {Response} res
               * @param {NextFunction} next
               * @returns {void}
               */
              middleware: (req, res, next) => {
                // serve-index doesn't fallthrough non-get/head request to next middleware
                if (req.method !== "GET" && req.method !== "HEAD") {
                  return next();
                }

                serveIndex(
                  staticOption.directory,
                  /** @type {ServeIndexOptions} */
                  (staticOption.serveIndex)
                )(req, res, next);
              },
            });
          }
        });
      });
    }

    if (this.options.magicHtml) {
      middlewares.push({
        name: "serve-magic-html",
        middleware: this.serveMagicHtml.bind(this),
      });
    }

    // Register this middleware always as the last one so that it's only used as a
    // fallback when no other middleware responses.
    middlewares.push({
      name: "options-middleware",
      path: "*",
      /**
       * @param {Request} req
       * @param {Response} res
       * @param {NextFunction} next
       * @returns {void}
       */
      middleware: (req, res, next) => {
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Content-Length", "0");
          res.end();
          return;
        }
        next();
      },
    });

    if (typeof this.options.setupMiddlewares === "function") {
      middlewares = this.options.setupMiddlewares(middlewares, this);
    }

    middlewares.forEach((middleware) => {
      if (typeof middleware === "function") {
        /** @type {import("express").Application} */
        (this.app).use(middleware);
      } else if (typeof middleware.path !== "undefined") {
        /** @type {import("express").Application} */
        (this.app).use(middleware.path, middleware.middleware);
      } else {
        /** @type {import("express").Application} */
        (this.app).use(middleware.middleware);
      }
    });

    if (typeof this.options.onAfterSetupMiddleware === "function") {
      this.options.onAfterSetupMiddleware(this);
    }
  }

  /**
   * @private
   * @returns {void}
   */
  createServer() {
    const { type, options } = /** @type {ServerConfiguration} */ (
      this.options.server
    );

    /** @type {import("http").Server | undefined | null} */
    // eslint-disable-next-line import/no-dynamic-require
    this.server = require(/** @type {string} */ (type)).createServer(
      options,
      this.app
    );

    /** @type {import("http").Server} */
    (this.server).on(
      "connection",
      /**
       * @param {Socket} socket
       */
      (socket) => {
        // Add socket to list
        this.sockets.push(socket);

        socket.once("close", () => {
          // Remove socket from list
          this.sockets.splice(this.sockets.indexOf(socket), 1);
        });
      }
    );

    /** @type {import("http").Server} */
    (this.server).on(
      "error",
      /**
       * @param {Error} error
       */
      (error) => {
        throw error;
      }
    );
  }

  /**
   * @private
   * @returns {void}
   */
  // TODO: remove `--web-socket-server` in favor of `--web-socket-server-type`
  createWebSocketServer() {
    /** @type {WebSocketServerImplementation | undefined | null} */
    this.webSocketServer = new /** @type {any} */ (this.getServerTransport())(
      this
    );
    /** @type {WebSocketServerImplementation} */
    (this.webSocketServer).implementation.on(
      "connection",
      /**
       * @param {ClientConnection} client
       * @param {IncomingMessage} request
       */
      (client, request) => {
        /** @type {{ [key: string]: string | undefined } | undefined} */
        const headers =
          // eslint-disable-next-line no-nested-ternary
          typeof request !== "undefined"
            ? /** @type {{ [key: string]: string | undefined }} */
              (request.headers)
            : typeof (
                /** @type {import("sockjs").Connection} */ (client).headers
              ) !== "undefined"
            ? /** @type {import("sockjs").Connection} */ (client).headers
            : // eslint-disable-next-line no-undefined
              undefined;

        if (!headers) {
          this.logger.warn(
            'webSocketServer implementation must pass headers for the "connection" event'
          );
        }

        if (
          !headers ||
          !this.checkHeader(headers, "host") ||
          !this.checkHeader(headers, "origin")
        ) {
          this.sendMessage([client], "error", "Invalid Host/Origin header");

          // With https enabled, the sendMessage above is encrypted asynchronously so not yet sent
          // Terminate would prevent it sending, so use close to allow it to be sent
          client.close();

          return;
        }

        if (this.options.hot === true || this.options.hot === "only") {
          this.sendMessage([client], "hot");
        }

        if (this.options.liveReload) {
          this.sendMessage([client], "liveReload");
        }

        if (
          this.options.client &&
          /** @type {ClientConfiguration} */
          (this.options.client).progress
        ) {
          this.sendMessage(
            [client],
            "progress",
            /** @type {ClientConfiguration} */
            (this.options.client).progress
          );
        }

        if (
          this.options.client &&
          /** @type {ClientConfiguration} */ (this.options.client).reconnect
        ) {
          this.sendMessage(
            [client],
            "reconnect",
            /** @type {ClientConfiguration} */
            (this.options.client).reconnect
          );
        }

        if (
          this.options.client &&
          /** @type {ClientConfiguration} */
          (this.options.client).overlay
        ) {
          const overlayConfig = /** @type {ClientConfiguration} */ (
            this.options.client
          ).overlay;

          this.sendMessage(
            [client],
            "overlay",
            typeof overlayConfig === "object"
              ? {
                  ...overlayConfig,
                  errors:
                    overlayConfig.errors &&
                    encodeOverlaySettings(overlayConfig.errors),
                  warnings:
                    overlayConfig.warnings &&
                    encodeOverlaySettings(overlayConfig.warnings),
                  runtimeErrors:
                    overlayConfig.runtimeErrors &&
                    encodeOverlaySettings(overlayConfig.runtimeErrors),
                }
              : overlayConfig
          );
        }

        if (!this.stats) {
          return;
        }

        this.sendStats([client], this.getStats(this.stats), true);
      }
    );
  }

  /**
   * @private
   * @param {string} defaultOpenTarget
   * @returns {void}
   */
  openBrowser(defaultOpenTarget) {
    const open = require("open");

    Promise.all(
      /** @type {NormalizedOpen[]} */
      (this.options.open).map((item) => {
        /**
         * @type {string}
         */
        let openTarget;

        if (item.target === "<url>") {
          openTarget = defaultOpenTarget;
        } else {
          openTarget = Server.isAbsoluteURL(item.target)
            ? item.target
            : new URL(item.target, defaultOpenTarget).toString();
        }

        return open(openTarget, item.options).catch(() => {
          this.logger.warn(
            `Unable to open "${openTarget}" page${
              item.options.app
                ? ` in "${
                    /** @type {import("open").App} */
                    (item.options.app).name
                  }" app${
                    /** @type {import("open").App} */
                    (item.options.app).arguments
                      ? ` with "${
                          /** @type {import("open").App} */
                          (item.options.app).arguments.join(" ")
                        }" arguments`
                      : ""
                  }`
                : ""
            }. If you are running in a headless environment, please do not use the "open" option or related flags like "--open", "--open-target", and "--open-app".`
          );
        });
      })
    );
  }

  /**
   * @private
   * @returns {void}
   */
  runBonjour() {
    const { Bonjour } = require("bonjour-service");
    /**
     * @private
     * @type {Bonjour | undefined}
     */
    this.bonjour = new Bonjour();
    this.bonjour.publish({
      // @ts-expect-error
      name: `Webpack Dev Server ${os.hostname()}:${this.options.port}`,
      // @ts-expect-error
      port: /** @type {number} */ (this.options.port),
      // @ts-expect-error
      type:
        /** @type {ServerConfiguration} */
        (this.options.server).type === "http" ? "http" : "https",
      subtypes: ["webpack"],
      .../** @type {BonjourOptions} */ (this.options.bonjour),
    });
  }

  /**
   * @private
   * @returns {void}
   */
  stopBonjour(callback = () => {}) {
    /** @type {Bonjour} */
    (this.bonjour).unpublishAll(() => {
      /** @type {Bonjour} */
      (this.bonjour).destroy();

      if (callback) {
        callback();
      }
    });
  }

  /**
   * @private
   * @returns {void}
   */
  logStatus() {
    const { isColorSupported, cyan, red } = require("colorette");

    /**
     * @param {Compiler["options"]} compilerOptions
     * @returns {boolean}
     */
    const getColorsOption = (compilerOptions) => {
      /**
       * @type {boolean}
       */
      let colorsEnabled;

      if (
        compilerOptions.stats &&
        typeof (/** @type {StatsOptions} */ (compilerOptions.stats).colors) !==
          "undefined"
      ) {
        colorsEnabled =
          /** @type {boolean} */
          (/** @type {StatsOptions} */ (compilerOptions.stats).colors);
      } else {
        colorsEnabled = isColorSupported;
      }

      return colorsEnabled;
    };

    const colors = {
      /**
       * @param {boolean} useColor
       * @param {string} msg
       * @returns {string}
       */
      info(useColor, msg) {
        if (useColor) {
          return cyan(msg);
        }

        return msg;
      },
      /**
       * @param {boolean} useColor
       * @param {string} msg
       * @returns {string}
       */
      error(useColor, msg) {
        if (useColor) {
          return red(msg);
        }

        return msg;
      },
    };
    const useColor = getColorsOption(this.getCompilerOptions());

    if (this.options.ipc) {
      this.logger.info(
        `Project is running at: "${
          /** @type {import("http").Server} */
          (this.server).address()
        }"`
      );
    } else {
      const protocol =
        /** @type {ServerConfiguration} */
        (this.options.server).type === "http" ? "http" : "https";
      const { address, port } =
        /** @type {import("net").AddressInfo} */
        (
          /** @type {import("http").Server} */
          (this.server).address()
        );
      /**
       * @param {string} newHostname
       * @returns {string}
       */
      const prettyPrintURL = (newHostname) =>
        url.format({ protocol, hostname: newHostname, port, pathname: "/" });

      let server;
      let localhost;
      let loopbackIPv4;
      let loopbackIPv6;
      let networkUrlIPv4;
      let networkUrlIPv6;

      if (this.options.host) {
        if (this.options.host === "localhost") {
          localhost = prettyPrintURL("localhost");
        } else {
          let isIP;

          try {
            isIP = ipaddr.parse(this.options.host);
          } catch (error) {
            // Ignore
          }

          if (!isIP) {
            server = prettyPrintURL(this.options.host);
          }
        }
      }

      const parsedIP = ipaddr.parse(address);

      if (parsedIP.range() === "unspecified") {
        localhost = prettyPrintURL("localhost");

        const networkIPv4 = Server.internalIPSync("v4");

        if (networkIPv4) {
          networkUrlIPv4 = prettyPrintURL(networkIPv4);
        }

        const networkIPv6 = Server.internalIPSync("v6");

        if (networkIPv6) {
          networkUrlIPv6 = prettyPrintURL(networkIPv6);
        }
      } else if (parsedIP.range() === "loopback") {
        if (parsedIP.kind() === "ipv4") {
          loopbackIPv4 = prettyPrintURL(parsedIP.toString());
        } else if (parsedIP.kind() === "ipv6") {
          loopbackIPv6 = prettyPrintURL(parsedIP.toString());
        }
      } else {
        networkUrlIPv4 =
          parsedIP.kind() === "ipv6" &&
          /** @type {IPv6} */
          (parsedIP).isIPv4MappedAddress()
            ? prettyPrintURL(
                /** @type {IPv6} */
                (parsedIP).toIPv4Address().toString()
              )
            : prettyPrintURL(address);

        if (parsedIP.kind() === "ipv6") {
          networkUrlIPv6 = prettyPrintURL(address);
        }
      }

      this.logger.info("Project is running at:");

      if (server) {
        this.logger.info(`Server: ${colors.info(useColor, server)}`);
      }

      if (localhost || loopbackIPv4 || loopbackIPv6) {
        const loopbacks = [];

        if (localhost) {
          loopbacks.push([colors.info(useColor, localhost)]);
        }

        if (loopbackIPv4) {
          loopbacks.push([colors.info(useColor, loopbackIPv4)]);
        }

        if (loopbackIPv6) {
          loopbacks.push([colors.info(useColor, loopbackIPv6)]);
        }

        this.logger.info(`Loopback: ${loopbacks.join(", ")}`);
      }

      if (networkUrlIPv4) {
        this.logger.info(
          `On Your Network (IPv4): ${colors.info(useColor, networkUrlIPv4)}`
        );
      }

      if (networkUrlIPv6) {
        this.logger.info(
          `On Your Network (IPv6): ${colors.info(useColor, networkUrlIPv6)}`
        );
      }

      if (/** @type {NormalizedOpen[]} */ (this.options.open).length > 0) {
        const openTarget = prettyPrintURL(
          !this.options.host ||
            this.options.host === "0.0.0.0" ||
            this.options.host === "::"
            ? "localhost"
            : this.options.host
        );

        this.openBrowser(openTarget);
      }
    }

    if (/** @type {NormalizedStatic[]} */ (this.options.static).length > 0) {
      this.logger.info(
        `Content not from webpack is served from '${colors.info(
          useColor,
          /** @type {NormalizedStatic[]} */
          (this.options.static)
            .map((staticOption) => staticOption.directory)
            .join(", ")
        )}' directory`
      );
    }

    if (this.options.historyApiFallback) {
      this.logger.info(
        `404s will fallback to '${colors.info(
          useColor,
          /** @type {ConnectHistoryApiFallbackOptions} */ (
            this.options.historyApiFallback
          ).index || "/index.html"
        )}'`
      );
    }

    if (this.options.bonjour) {
      const bonjourProtocol =
        /** @type {BonjourOptions} */
        (this.options.bonjour).type ||
        /** @type {ServerConfiguration} */
        (this.options.server).type === "http"
          ? "http"
          : "https";

      this.logger.info(
        `Broadcasting "${bonjourProtocol}" with subtype of "webpack" via ZeroConf DNS (Bonjour)`
      );
    }
  }

  /**
   * @private
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  setHeaders(req, res, next) {
    let { headers } = this.options;

    if (headers) {
      if (typeof headers === "function") {
        headers = headers(
          req,
          res,
          /** @type {import("webpack-dev-middleware").API<Request, Response>}*/
          (this.middleware).context
        );
      }

      /**
       * @type {{key: string, value: string}[]}
       */
      const allHeaders = [];

      if (!Array.isArray(headers)) {
        // eslint-disable-next-line guard-for-in
        for (const name in headers) {
          // @ts-ignore
          allHeaders.push({ key: name, value: headers[name] });
        }

        headers = allHeaders;
      }

      headers.forEach(
        /**
         * @param {{key: string, value: any}} header
         */
        (header) => {
          res.setHeader(header.key, header.value);
        }
      );
    }

    next();
  }

  /**
   * @private
   * @param {{ [key: string]: string | undefined }} headers
   * @param {string} headerToCheck
   * @returns {boolean}
   */
  checkHeader(headers, headerToCheck) {
    // allow user to opt out of this security check, at their own risk
    // by explicitly enabling allowedHosts
    if (this.options.allowedHosts === "all") {
      return true;
    }

    // get the Host header and extract hostname
    // we don't care about port not matching
    const hostHeader = headers[headerToCheck];

    if (!hostHeader) {
      return false;
    }

    if (/^(file|.+-extension):/i.test(hostHeader)) {
      return true;
    }

    // use the node url-parser to retrieve the hostname from the host-header.
    const hostname = url.parse(
      // if hostHeader doesn't have scheme, add // for parsing.
      /^(.+:)?\/\//.test(hostHeader) ? hostHeader : `//${hostHeader}`,
      false,
      true
    ).hostname;

    // always allow requests with explicit IPv4 or IPv6-address.
    // A note on IPv6 addresses:
    // hostHeader will always contain the brackets denoting
    // an IPv6-address in URLs,
    // these are removed from the hostname in url.parse(),
    // so we have the pure IPv6-address in hostname.
    // For convenience, always allow localhost (hostname === 'localhost')
    // and its subdomains (hostname.endsWith(".localhost")).
    // allow hostname of listening address  (hostname === this.options.host)
    const isValidHostname =
      (hostname !== null && ipaddr.IPv4.isValid(hostname)) ||
      (hostname !== null && ipaddr.IPv6.isValid(hostname)) ||
      hostname === "localhost" ||
      (hostname !== null && hostname.endsWith(".localhost")) ||
      hostname === this.options.host;

    if (isValidHostname) {
      return true;
    }

    const { allowedHosts } = this.options;

    // always allow localhost host, for convenience
    // allow if hostname is in allowedHosts
    if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
      for (let hostIdx = 0; hostIdx < allowedHosts.length; hostIdx++) {
        const allowedHost = allowedHosts[hostIdx];

        if (allowedHost === hostname) {
          return true;
        }

        // support "." as a subdomain wildcard
        // e.g. ".example.com" will allow "example.com", "www.example.com", "subdomain.example.com", etc
        if (allowedHost[0] === ".") {
          // "example.com"  (hostname === allowedHost.substring(1))
          // "*.example.com"  (hostname.endsWith(allowedHost))
          if (
            hostname === allowedHost.substring(1) ||
            /** @type {string} */ (hostname).endsWith(allowedHost)
          ) {
            return true;
          }
        }
      }
    }

    // Also allow if `client.webSocketURL.hostname` provided
    if (
      this.options.client &&
      typeof (
        /** @type {ClientConfiguration} */ (this.options.client).webSocketURL
      ) !== "undefined"
    ) {
      return (
        /** @type {WebSocketURL} */
        (/** @type {ClientConfiguration} */ (this.options.client).webSocketURL)
          .hostname === hostname
      );
    }

    // disallow
    return false;
  }

  /**
   * @param {ClientConnection[]} clients
   * @param {string} type
   * @param {any} [data]
   * @param {any} [params]
   */
  // eslint-disable-next-line class-methods-use-this
  sendMessage(clients, type, data, params) {
    for (const client of clients) {
      // `sockjs` uses `1` to indicate client is ready to accept data
      // `ws` uses `WebSocket.OPEN`, but it is mean `1` too
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type, data, params }));
      }
    }
  }

  /**
   * @private
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   * @returns {void}
   */
  serveMagicHtml(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    /** @type {import("webpack-dev-middleware").API<Request, Response>}*/
    (this.middleware).waitUntilValid(() => {
      const _path = req.path;

      try {
        const filename =
          /** @type {import("webpack-dev-middleware").API<Request, Response>}*/
          (this.middleware).getFilenameFromUrl(`${_path}.js`);
        const isFile =
          /** @type {Compiler["outputFileSystem"] & { statSync: import("fs").StatSyncFn }}*/
          (
            /** @type {import("webpack-dev-middleware").API<Request, Response>}*/
            (this.middleware).context.outputFileSystem
          )
            .statSync(/** @type {import("fs").PathLike} */ (filename))
            .isFile();

        if (!isFile) {
          return next();
        }

        // Serve a page that executes the javascript
        // @ts-ignore
        const queries = req._parsedUrl.search || "";
        const responsePage = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><script type="text/javascript" charset="utf-8" src="${_path}.js${queries}"></script></body></html>`;

        res.send(responsePage);
      } catch (error) {
        return next();
      }
    });
  }

  // Send stats to a socket or multiple sockets
  /**
   * @private
   * @param {ClientConnection[]} clients
   * @param {StatsCompilation} stats
   * @param {boolean} [force]
   */
  sendStats(clients, stats, force) {
    const shouldEmit =
      !force &&
      stats &&
      (!stats.errors || stats.errors.length === 0) &&
      (!stats.warnings || stats.warnings.length === 0) &&
      this.currentHash === stats.hash;

    if (shouldEmit) {
      this.sendMessage(clients, "still-ok");

      return;
    }

    this.currentHash = stats.hash;
    this.sendMessage(clients, "hash", stats.hash);

    if (
      /** @type {NonNullable<StatsCompilation["errors"]>} */
      (stats.errors).length > 0 ||
      /** @type {NonNullable<StatsCompilation["warnings"]>} */
      (stats.warnings).length > 0
    ) {
      const hasErrors =
        /** @type {NonNullable<StatsCompilation["errors"]>} */
        (stats.errors).length > 0;

      if (
        /** @type {NonNullable<StatsCompilation["warnings"]>} */
        (stats.warnings).length > 0
      ) {
        let params;

        if (hasErrors) {
          params = { preventReloading: true };
        }

        this.sendMessage(clients, "warnings", stats.warnings, params);
      }

      if (
        /** @type {NonNullable<StatsCompilation["errors"]>} */ (stats.errors)
          .length > 0
      ) {
        this.sendMessage(clients, "errors", stats.errors);
      }
    } else {
      this.sendMessage(clients, "ok");
    }
  }

  /**
   * @param {string | string[]} watchPath
   * @param {WatchOptions} [watchOptions]
   */
  watchFiles(watchPath, watchOptions) {
    const chokidar = require("chokidar");
    const watcher = chokidar.watch(watchPath, watchOptions);

    // disabling refreshing on changing the content
    if (this.options.liveReload) {
      watcher.on("change", (item) => {
        if (this.webSocketServer) {
          this.sendMessage(
            this.webSocketServer.clients,
            "static-changed",
            item
          );
        }
      });
    }

    this.staticWatchers.push(watcher);
  }

  /**
   * @param {import("webpack-dev-middleware").Callback} [callback]
   */
  invalidate(callback = () => {}) {
    if (this.middleware) {
      this.middleware.invalidate(callback);
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async start() {
    await this.normalizeOptions();

    if (this.options.ipc) {
      await /** @type {Promise<void>} */ (
        new Promise((resolve, reject) => {
          const net = require("net");
          const socket = new net.Socket();

          socket.on(
            "error",
            /**
             * @param {Error & { code?: string }} error
             */
            (error) => {
              if (error.code === "ECONNREFUSED") {
                // No other server listening on this socket, so it can be safely removed
                fs.unlinkSync(/** @type {string} */ (this.options.ipc));

                resolve();

                return;
              } else if (error.code === "ENOENT") {
                resolve();

                return;
              }

              reject(error);
            }
          );

          socket.connect(
            { path: /** @type {string} */ (this.options.ipc) },
            () => {
              throw new Error(`IPC "${this.options.ipc}" is already used`);
            }
          );
        })
      );
    } else {
      this.options.host = await Server.getHostname(
        /** @type {Host} */ (this.options.host)
      );
      this.options.port = await Server.getFreePort(
        /** @type {Port} */ (this.options.port),
        this.options.host
      );
    }

    await this.initialize();

    const listenOptions = this.options.ipc
      ? { path: this.options.ipc }
      : { host: this.options.host, port: this.options.port };

    await /** @type {Promise<void>} */ (
      new Promise((resolve) => {
        /** @type {import("http").Server} */
        (this.server).listen(listenOptions, () => {
          resolve();
        });
      })
    );

    if (this.options.ipc) {
      // chmod 666 (rw rw rw)
      const READ_WRITE = 438;

      await fs.promises.chmod(
        /** @type {string} */ (this.options.ipc),
        READ_WRITE
      );
    }

    if (this.options.webSocketServer) {
      this.createWebSocketServer();
    }

    if (this.options.bonjour) {
      this.runBonjour();
    }

    this.logStatus();

    if (typeof this.options.onListening === "function") {
      this.options.onListening(this);
    }
  }

  /**
   * @param {(err?: Error) => void} [callback]
   */
  startCallback(callback = () => {}) {
    this.start()
      .then(() => callback(), callback)
      .catch(callback);
  }

  /**
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.bonjour) {
      await /** @type {Promise<void>} */ (
        new Promise((resolve) => {
          this.stopBonjour(() => {
            resolve();
          });
        })
      );
    }

    this.webSocketProxies = [];

    await Promise.all(this.staticWatchers.map((watcher) => watcher.close()));

    this.staticWatchers = [];

    if (this.webSocketServer) {
      await /** @type {Promise<void>} */ (
        new Promise((resolve) => {
          /** @type {WebSocketServerImplementation} */
          (this.webSocketServer).implementation.close(() => {
            this.webSocketServer = null;

            resolve();
          });

          for (const client of /** @type {WebSocketServerImplementation} */ (
            this.webSocketServer
          ).clients) {
            client.terminate();
          }

          /** @type {WebSocketServerImplementation} */
          (this.webSocketServer).clients = [];
        })
      );
    }

    if (this.server) {
      await /** @type {Promise<void>} */ (
        new Promise((resolve) => {
          /** @type {import("http").Server} */
          (this.server).close(() => {
            this.server = null;

            resolve();
          });

          for (const socket of this.sockets) {
            socket.destroy();
          }

          this.sockets = [];
        })
      );

      if (this.middleware) {
        await /** @type {Promise<void>} */ (
          new Promise((resolve, reject) => {
            /** @type {import("webpack-dev-middleware").API<Request, Response>}*/
            (this.middleware).close((error) => {
              if (error) {
                reject(error);

                return;
              }

              resolve();
            });
          })
        );

        this.middleware = null;
      }
    }

    // We add listeners to signals when creating a new Server instance
    // So ensure they are removed to prevent EventEmitter memory leak warnings
    for (const item of this.listeners) {
      process.removeListener(item.name, item.listener);
    }
  }

  /**
   * @param {(err?: Error) => void} [callback]
   */
  stopCallback(callback = () => {}) {
    this.stop()
      .then(() => callback(), callback)
      .catch(callback);
  }

  // TODO remove in the next major release
  /**
   * @param {Port} port
   * @param {Host} hostname
   * @param {(err?: Error) => void} fn
   * @returns {void}
   */
  listen(port, hostname, fn) {
    util.deprecate(
      () => {},
      "'listen' is deprecated. Please use the async 'start' or 'startCallback' method.",
      "DEP_WEBPACK_DEV_SERVER_LISTEN"
    )();

    if (typeof port === "function") {
      fn = port;
    }

    if (
      typeof port !== "undefined" &&
      typeof this.options.port !== "undefined" &&
      port !== this.options.port
    ) {
      this.options.port = port;

      this.logger.warn(
        'The "port" specified in options is different from the port passed as an argument. Will be used from arguments.'
      );
    }

    if (!this.options.port) {
      this.options.port = port;
    }

    if (
      typeof hostname !== "undefined" &&
      typeof this.options.host !== "undefined" &&
      hostname !== this.options.host
    ) {
      this.options.host = hostname;

      this.logger.warn(
        'The "host" specified in options is different from the host passed as an argument. Will be used from arguments.'
      );
    }

    if (!this.options.host) {
      this.options.host = hostname;
    }

    this.start()
      .then(() => {
        if (fn) {
          fn.call(this.server);
        }
      })
      .catch((error) => {
        // Nothing
        if (fn) {
          fn.call(this.server, error);
        }
      });
  }

  /**
   * @param {(err?: Error) => void} [callback]
   * @returns {void}
   */
  // TODO remove in the next major release
  close(callback) {
    util.deprecate(
      () => {},
      "'close' is deprecated. Please use the async 'stop' or 'stopCallback' method.",
      "DEP_WEBPACK_DEV_SERVER_CLOSE"
    )();

    this.stop()
      .then(() => {
        if (callback) {
          callback();
        }
      })
      .catch((error) => {
        if (callback) {
          callback(error);
        }
      });
  }
}

module.exports = Server;
