/// <reference types="node" />
export = Server;
declare class Server {
  static get cli(): {
    readonly getArguments: () => {
      "allowed-hosts": {
        configs: (
          | {
              type: string;
              multiple: boolean;
              description: string;
              path: string;
            }
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
              values: string[];
            }
        )[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "allowed-hosts-reset": {
        configs: {
          type: string;
          multiple: boolean;
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
          description: string;
          path: string;
        }[];
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
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      bonjour: {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      client: {
        configs: {
          description: string;
          negatedDescription: string;
          multiple: boolean;
          path: string;
          type: string;
          values: boolean[];
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "client-logging": {
        configs: {
          type: string;
          values: string[];
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-overlay": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-overlay-errors": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          /**
           * @typedef {Object} ServerConfiguration
           * @property {"http" | "https" | "spdy" | string} [type]
           * @property {ServerOptions} [options]
           */
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
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
        multiple: boolean;
      };
      "client-overlay-trusted-types-policy-name": {
        configs: {
          description: string;
          multiple: boolean;
          /**
           * @typedef {import("ws").WebSocketServer | import("sockjs").Server & { close: import("ws").WebSocketServer["close"] }} WebSocketServer
           */
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "client-overlay-warnings": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-overlay-runtime-errors": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-progress": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-reconnect": {
        configs: (
          | {
              type: string;
              multiple: boolean;
              description: string;
              negatedDescription: string;
              path: string;
            }
          | {
              type: string;
              multiple: boolean;
              description: string;
              path: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-web-socket-transport": {
        configs: (
          | {
              type: string;
              values: string[];
              multiple: boolean;
              description: string;
              path: string;
            }
          | {
              type: string;
              multiple: boolean;
              description: string;
              path: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-web-socket-url": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-web-socket-url-hostname": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        /** @type {T} */ multiple: boolean;
      };
      "client-web-socket-url-password": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-web-socket-url-pathname": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-web-socket-url-port": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "client-web-socket-url-protocol": {
        configs: (
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
              values: string[];
            }
          | {
              description: string;
              /**
               * @private
               * @type {RequestHandler[]}
               */
              multiple: boolean;
              path: string;
              type: string;
              /**
               * @type {Socket[]}
               */
            }
        )[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "client-web-socket-url-username": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      compress: {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "history-api-fallback": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      host: {
        configs: (
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
              values: string[];
            }
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      hot: {
        configs: (
          | {
              type: string;
              multiple: boolean;
              description: string;
              negatedDescription: string;
              path: string;
            }
          | {
              type: string;
              values: string[];
              multiple: boolean;
              description: string;
              path: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      http2: {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      https: {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      /**
       * @type {string | undefined}
       */
      "https-ca": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "https-ca-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "https-cacert": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "https-cacert-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "https-cert": {
        configs: {
          type: string;
          multiple: boolean;
          /** @type {ClientConfiguration} */ description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "https-cert-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "https-crl": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "https-crl-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "https-key": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "https-key-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        /** @type {string} */ simpleType: string;
      };
      "https-passphrase": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "https-pfx": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "https-pfx-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "https-request-cert": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      ipc: {
        configs: (
          | {
              type: string;
              multiple: boolean;
              description: string;
              path: string;
            }
          | {
              type: string;
              values: boolean[];
              multiple: boolean;
              description: string;
              path: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "live-reload": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        /**
         * prependEntry Method for webpack 4
         * @param {any} originalEntry
         * @param {any} newAdditionalEntries
         * @returns {any}
         */
        multiple: boolean;
      };
      "magic-html": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      open: {
        configs: (
          | {
              type: string;
              multiple: boolean;
              description: string;
              path: string;
            }
          | {
              /** @type {any} */
              type: string;
              multiple: boolean;
              /** @type {any} */ description: string;
              negatedDescription: string;
              path: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "open-app": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "open-app-name": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "open-app-name-reset": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "open-reset": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "open-target": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "open-target-reset": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      port: {
        configs: (
          | {
              type: string;
              multiple: boolean;
              description: string;
              path: string;
            }
          | {
              type: string;
              values: string[];
              multiple: boolean;
              description: string;
              path: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "server-options-ca": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-ca-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-cacert": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-cacert-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-cert": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-cert-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-crl": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-crl-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-key": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-key-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-passphrase": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-pfx": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-pfx-reset": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-options-request-cert": {
        configs: {
          description: string;
          negatedDescription: string;
          multiple: boolean;
          path: string;
          type: string;
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      "server-type": {
        configs: {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
          values: string[];
        }[];
        description: string;
        multiple: boolean;
        simpleType: string;
      };
      static: {
        configs: (
          | {
              type: string;
              multiple: boolean;
              description: string;
              path: string;
            }
          | {
              type: string;
              multiple: boolean;
              description: string;
              negatedDescription: string;
              path: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "static-directory": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "static-public-path": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "static-public-path-reset": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "static-reset": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean /** @type {any} */;
      };
      /** @type {any} */
      "static-serve-index": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "static-watch": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "watch-files": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "watch-files-reset": {
        configs: {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "web-socket-server": {
        configs: (
          | {
              description: string;
              negatedDescription: string;
              multiple: boolean;
              path: string;
              type: string;
              values: boolean[];
            }
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
              values: string[];
            }
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
      "web-socket-server-type": {
        configs: (
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
              values: string[];
            }
          | {
              description: string;
              multiple: boolean;
              path: string;
              type: string;
            }
        )[];
        description: string;
        simpleType: string;
        multiple: boolean;
      };
    };
    readonly processArguments: (
      args: Record<string, import("../bin/process-arguments").Argument>,
      config: any,
      values: Record<
        string,
        | string
        | number
        | boolean
        | RegExp
        | (string | number | boolean | RegExp)[]
      >
    ) => import("../bin/process-arguments").Problem[] | null;
  };
  static get schema(): {
    title: string;
    type: string;
    definitions: {
      AllowedHosts: {
        anyOf: (
          | {
              type: string;
              minItems: number;
              items: {
                $ref: string;
              };
              enum?: undefined;
              $ref?: undefined;
            }
          | {
              enum: string[];
              type?: undefined;
              minItems?: undefined;
              items?: undefined;
              $ref?: undefined;
            }
          | {
              $ref: string;
              type?: undefined;
              minItems?: undefined;
              items?: undefined;
              enum?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      AllowedHostsItem: {
        type: string;
        minLength: number;
      };
      Bonjour: {
        anyOf: (
          | {
              type: string;
              cli: {
                negatedDescription: string;
              };
              description?: undefined;
              link?: undefined;
            }
          | {
              type: string;
              description: string;
              link: string;
              cli?: undefined;
            }
        )[];
        description: string;
        link: string /** @typedef {import("connect-history-api-fallback").Options} ConnectHistoryApiFallbackOptions */;
      };
      Client: {
        description: string;
        link: string;
        anyOf: (
          | {
              enum: boolean[];
              cli: {
                negatedDescription: string;
              };
              type?: undefined;
              additionalProperties?: undefined;
              properties?: undefined;
            }
          | {
              type: string;
              additionalProperties: boolean;
              properties: {
                logging: {
                  $ref: string;
                };
                overlay: {
                  $ref: string;
                };
                progress: {
                  $ref: string;
                };
                reconnect: {
                  $ref: string;
                };
                webSocketTransport: {
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
                  $ref: string;
                };
                webSocketURL: {
                  $ref: string;
                };
              };
              enum?: undefined;
              cli?: undefined;
            }
        )[];
      };
      ClientLogging: {
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
        enum: string[];
        description: string;
        link: string;
      };
      ClientOverlay: {
        anyOf: (
          | {
              description: string;
              link: string;
              type: string;
              cli: {
                negatedDescription: string;
              };
              additionalProperties?: undefined;
              properties?: undefined;
            }
          | {
              type: string;
              additionalProperties: boolean;
              properties: {
                errors: {
                  anyOf: (
                    | {
                        description: string;
                        type: string;
                        cli: {
                          negatedDescription: string;
                        };
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
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
                        description: string;
                        type?: undefined;
                        cli?: undefined;
                      }
                  )[];
                };
                warnings: {
                  anyOf: (
                    | {
                        description: string;
                        type: string;
                        cli: {
                          negatedDescription: string;
                        };
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        description: string;
                        type?: undefined;
                        cli?: undefined;
                      }
                  )[];
                };
                runtimeErrors: {
                  anyOf: (
                    | {
                        description: string;
                        type: string;
                        cli: {
                          negatedDescription: string;
                        };
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        description: string;
                        type?: undefined;
                        cli?: undefined;
                      }
                  )[];
                };
                trustedTypesPolicyName: {
                  description: string;
                  type: string;
                };
              };
              description?: undefined;
              link?: undefined;
              cli?: undefined;
            }
        )[];
      };
      ClientProgress: {
        description: string;
        link: string;
        type: string;
        cli: {
          negatedDescription: string;
        };
      };
      ClientReconnect: {
        description: string;
        link: string;
        anyOf: (
          | {
              type: string;
              cli: {
                negatedDescription: string;
              };
              minimum?: undefined;
            }
          | {
              type: string;
              minimum: number;
              cli?: undefined;
            }
        )[];
      };
      ClientWebSocketTransport: {
        anyOf: {
          $ref: string;
        }[];
        description: string;
        link: string;
      };
      ClientWebSocketTransportEnum: {
        enum: string[];
      };
      ClientWebSocketTransportString: {
        type: string;
        minLength: number;
      };
      ClientWebSocketURL: {
        description: string;
        link: string;
        anyOf: (
          | {
              type: string;
              minLength: number;
              additionalProperties?: undefined;
              properties?: undefined;
            }
          | {
              type: string;
              additionalProperties: boolean;
              properties: {
                hostname: {
                  description: string;
                  type: string;
                  minLength: number;
                };
                pathname: {
                  description: string;
                  type: string;
                };
                password: {
                  description: string;
                  type: string;
                };
                port: {
                  description: string;
                  anyOf: (
                    | {
                        type: string;
                        minLength?: undefined;
                      }
                    | {
                        type: string;
                        minLength: number;
                      }
                  )[];
                };
                protocol: {
                  description: string;
                  anyOf: (
                    | {
                        enum: string[];
                        type?: undefined;
                        minLength?: undefined;
                      }
                    | {
                        type: string;
                        minLength: number;
                        enum?: undefined;
                      }
                  )[];
                };
                username: {
                  description: string;
                  type: string;
                };
              };
              minLength?: undefined;
            }
        )[];
      };
      Compress: {
        type: string;
        description: string;
        link: string;
        cli: {
          negatedDescription: string;
        };
      };
      DevMiddleware: {
        description: string;
        link: string;
        type: string;
        additionalProperties: boolean;
      };
      HTTP2: {
        type: string;
        description: string;
        link: string;
        cli: {
          negatedDescription: string;
        };
      };
      HTTPS: {
        anyOf: (
          | {
              type: string;
              cli: {
                negatedDescription: string;
              };
              additionalProperties?: undefined;
              properties?: undefined;
            }
          | {
              type: string;
              additionalProperties: boolean;
              properties: {
                passphrase: {
                  type: string;
                  description: string;
                };
                requestCert: {
                  type: string;
                  description: string;
                  cli: {
                    negatedDescription: string;
                  };
                };
                /**
                 * @private
                 * @type {string | undefined}
                 */
                ca: {
                  anyOf: (
                    | {
                        type: string;
                        items: {
                          anyOf: (
                            | {
                                type: string;
                                instanceof?: undefined;
                              }
                            | {
                                instanceof: string;
                                type?: undefined;
                              }
                          )[];
                        };
                        instanceof?: undefined;
                      }
                    | {
                        type: string;
                        items?: undefined;
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        type?: undefined;
                        items?: undefined;
                      }
                  )[];
                  description: string;
                };
                cacert: {
                  anyOf: (
                    | {
                        type: string;
                        items: {
                          anyOf: (
                            | {
                                type: string;
                                instanceof?: undefined;
                              }
                            | {
                                instanceof: string;
                                type?: undefined;
                              }
                          )[];
                        };
                        instanceof?: undefined;
                      }
                    | {
                        type: string;
                        items?: undefined;
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        type?: undefined;
                        items?: undefined;
                      }
                  )[];
                  description: string;
                };
                cert: {
                  anyOf: (
                    | {
                        type: string;
                        items: {
                          anyOf: (
                            | {
                                type: string;
                                instanceof?: undefined;
                              }
                            | {
                                instanceof: string;
                                type?: undefined;
                              }
                          )[];
                        };
                        instanceof?: undefined;
                      }
                    | {
                        type: string;
                        items?: undefined;
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        type?: undefined;
                        items?: undefined;
                      }
                  )[];
                  description: string;
                };
                crl: {
                  anyOf: (
                    | {
                        type: string;
                        items: {
                          anyOf: (
                            | {
                                type: string;
                                instanceof?: undefined;
                              }
                            | {
                                instanceof: string;
                                type?: undefined;
                              }
                          )[];
                        };
                        instanceof?: undefined;
                      }
                    | {
                        type: string;
                        items?: undefined;
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        type?: undefined;
                        items?: undefined;
                      }
                  )[];
                  description: string;
                };
                key: {
                  anyOf: (
                    | {
                        type: string;
                        items: {
                          anyOf: (
                            | {
                                type: string;
                                instanceof?: undefined;
                                additionalProperties?: undefined;
                              }
                            | {
                                instanceof: string;
                                type?: undefined;
                                additionalProperties?: undefined;
                              }
                            | {
                                type: string;
                                additionalProperties: boolean;
                                instanceof?: undefined;
                              }
                          )[];
                        };
                        instanceof?: undefined;
                      }
                    | {
                        type: string;
                        items?: undefined;
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        type?: undefined;
                        items?: undefined;
                      }
                  )[];
                  description: string;
                };
                pfx: {
                  anyOf: (
                    | {
                        type: string;
                        items: {
                          anyOf: (
                            | {
                                type: string;
                                instanceof?: undefined;
                                additionalProperties?: undefined;
                              }
                            | {
                                instanceof: string;
                                type?: undefined;
                                additionalProperties?: undefined;
                              }
                            | {
                                type: string;
                                additionalProperties: boolean;
                                instanceof?: undefined;
                              }
                          )[];
                        };
                        instanceof?: undefined;
                      }
                    | {
                        type: string;
                        items?: undefined;
                        instanceof?: undefined;
                      }
                    | {
                        instanceof: string;
                        type?: undefined;
                        items?: undefined;
                      }
                  )[];
                  description: string;
                };
              };
              cli?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      HeaderObject: {
        type: string;
        additionalProperties: boolean;
        properties: {
          key: {
            description: string;
            type: string;
          };
          value: {
            description: string;
            type: string;
          };
        };
        cli: {
          exclude: boolean;
        };
      };
      Headers: {
        anyOf: (
          | {
              type: string;
              items: {
                $ref: string;
              };
              minItems: number;
              instanceof?: undefined;
            }
          | {
              type: string;
              items?: undefined;
              minItems?: undefined;
              instanceof?: undefined;
            }
          | {
              instanceof: string;
              type?: undefined;
              items?: undefined;
              minItems?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      HistoryApiFallback: {
        anyOf: (
          | {
              type: string;
              cli: {
                negatedDescription: string;
              };
              description?: undefined;
              link?: undefined;
            }
          | {
              type: string;
              description: string;
              /** @type {{ type: WebSocketServerConfiguration["type"], options: NonNullable<WebSocketServerConfiguration["options"]> }} */
              link: string;
              cli?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      Host: {
        description: string;
        link: string;
        anyOf: (
          | {
              enum: string[];
              type?: undefined;
              minLength?: undefined;
            }
          | {
              type: string;
              minLength: number;
              enum?: undefined;
            }
        )[];
      };
      Hot: {
        anyOf: (
          | {
              type: string;
              cli: {
                negatedDescription: string;
              };
              enum?: undefined;
            }
          | {
              enum: string[];
              /** @type {string} */ type?: undefined;
              cli?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      IPC: {
        anyOf: (
          | {
              type: string;
              minLength: number;
              enum?: undefined;
            }
          | {
              type: string;
              enum: boolean[];
              minLength?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      LiveReload: {
        type: string;
        description: string;
        cli: {
          negatedDescription: string;
        };
        link: string;
      };
      MagicHTML: {
        type: string;
        description: string;
        cli: {
          negatedDescription: string;
        };
        link: string;
      };
      OnAfterSetupMiddleware: {
        instanceof: string;
        description: string;
        link: string;
      };
      OnBeforeSetupMiddleware: {
        instanceof: string;
        description: string;
        link: string;
      };
      OnListening: {
        instanceof: string;
        description: string;
        link: string;
      };
      Open: {
        anyOf: (
          | {
              type: string;
              items: {
                anyOf: {
                  $ref: string;
                }[];
              };
              $ref?: undefined;
            }
          | {
              $ref: string;
              type?: undefined;
              items?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      OpenBoolean: {
        type: string;
        cli: {
          negatedDescription: string;
        };
      };
      OpenObject: {
        type: string;
        additionalProperties: boolean;
        properties: {
          target: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    type: string;
                  };
                }
              | {
                  type: string;
                  items?: undefined;
                }
            )[];
            description: string;
          };
          app: {
            anyOf: (
              | {
                  type: string;
                  additionalProperties: boolean;
                  properties: {
                    name: {
                      anyOf: (
                        | {
                            type: string;
                            items: {
                              type: string;
                              minLength: number;
                            };
                            minItems: number;
                            minLength?: undefined;
                          }
                        | {
                            type: string;
                            minLength: number;
                            items?: undefined;
                            minItems?: undefined;
                          }
                      )[];
                    };
                    arguments: {
                      items: {
                        type: string;
                        minLength: number;
                      };
                    };
                  };
                  minLength?: undefined;
                  description?: undefined;
                  cli?: undefined;
                }
              | {
                  type: string;
                  minLength: number;
                  description: string;
                  cli: {
                    description: string;
                  };
                  additionalProperties?: undefined;
                  properties?: undefined;
                }
            )[];
            description: string;
          };
        };
      };
      OpenString: {
        type: string;
        minLength: number;
      };
      Port: {
        anyOf: (
          | {
              type: string;
              minimum: number;
              maximum: number;
              minLength?: undefined;
              enum?: undefined;
            }
          | {
              type: string;
              minLength: number;
              minimum?: undefined;
              maximum?: undefined;
              enum?: undefined;
            }
          | {
              enum: string[];
              type?: undefined;
              minimum?: undefined;
              maximum?: undefined;
              minLength?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      Proxy: {
        anyOf: (
          | {
              type: string;
              items?: undefined;
            }
          | {
              type: string;
              items: {
                anyOf: (
                  | {
                      type: string;
                      instanceof?: undefined;
                    }
                  | {
                      instanceof: string;
                      type?: undefined;
                    }
                )[];
              };
            }
        )[];
        description: string;
        link: string;
      };
      Server: {
        anyOf: {
          $ref: string;
        }[];
        link: string;
        description: string;
      };
      ServerType: {
        enum: string[];
      };
      ServerEnum: {
        enum: string[];
        cli: {
          exclude: boolean;
        };
      };
      ServerString: {
        type: string;
        /** @type {string} */ minLength: number;
        cli: {
          exclude: boolean;
        };
      };
      ServerObject: {
        type: string;
        properties: {
          type: {
            anyOf: {
              $ref: string;
            }[];
          };
          options: {
            $ref: string;
          };
        };
        additionalProperties: boolean;
      };
      ServerOptions: {
        type: string;
        additionalProperties: boolean;
        properties: {
          passphrase: {
            type: string;
            description: string;
          };
          requestCert: {
            type: string;
            description: string;
            cli: {
              negatedDescription: string;
            };
          };
          ca: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    anyOf: (
                      | {
                          type: string;
                          instanceof?: undefined;
                        }
                      | {
                          instanceof: string;
                          type?: undefined;
                        }
                    )[];
                  };
                  instanceof?: undefined;
                }
              | {
                  type: string;
                  items?: undefined;
                  instanceof?: undefined;
                }
              | {
                  instanceof: string;
                  type?: undefined;
                  items?: undefined;
                }
            )[];
            description: string;
          };
          cacert: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    anyOf: (
                      | {
                          type: string;
                          instanceof?: undefined;
                        }
                      | {
                          instanceof: string;
                          type?: undefined;
                        }
                    )[];
                  };
                  instanceof?: undefined;
                }
              | {
                  type: string;
                  items?: undefined;
                  instanceof?: undefined;
                }
              | {
                  instanceof: string;
                  type?: undefined;
                  items?: undefined;
                }
            )[];
            description: string;
          };
          cert: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    anyOf: (
                      | {
                          type: string;
                          instanceof?: undefined;
                        }
                      | {
                          instanceof: string;
                          type?: undefined;
                        }
                    )[];
                  };
                  instanceof?: undefined;
                }
              | {
                  type: string;
                  items?: undefined;
                  instanceof?: undefined;
                }
              | {
                  instanceof: string;
                  type?: undefined;
                  items?: undefined;
                }
            )[];
            description: string;
          };
          crl: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    anyOf: (
                      | {
                          type: string;
                          instanceof?: undefined;
                        }
                      | {
                          instanceof: string;
                          type?: undefined;
                        }
                    )[];
                  };
                  instanceof?: undefined;
                }
              | {
                  type: string;
                  items?: undefined;
                  instanceof?: undefined;
                }
              | {
                  instanceof: string;
                  type?: undefined;
                  items?: undefined;
                }
            )[];
            description: string;
          };
          key: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    anyOf: (
                      | {
                          type: string;
                          instanceof?: undefined;
                          additionalProperties?: undefined;
                        }
                      | {
                          instanceof: string;
                          type?: undefined;
                          additionalProperties?: undefined;
                        }
                      | {
                          type: string;
                          additionalProperties: boolean;
                          instanceof?: undefined;
                        }
                    )[];
                  };
                  instanceof?: undefined;
                }
              | {
                  type: string;
                  items?: undefined;
                  instanceof?: undefined;
                }
              | {
                  instanceof: string;
                  type?: undefined;
                  items?: undefined;
                }
            )[];
            description: string;
          };
          /** @type {NormalizedStatic} */
          pfx: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    anyOf: (
                      | {
                          type: string;
                          instanceof?: undefined;
                          additionalProperties?: undefined;
                        }
                      | {
                          instanceof: string;
                          type?: undefined;
                          additionalProperties?: undefined;
                        }
                      | {
                          type: string;
                          additionalProperties: boolean;
                          instanceof?: undefined;
                        }
                    )[];
                  };
                  instanceof?: undefined;
                }
              | {
                  type: string;
                  items?: undefined;
                  instanceof?: undefined;
                }
              | {
                  instanceof: string;
                  type?: undefined;
                  items?: undefined;
                }
            )[];
            description: string;
          };
        };
      };
      SetupExitSignals: {
        type: string;
        description: string;
        link: string;
        cli: {
          exclude: boolean;
        };
      };
      SetupMiddlewares: {
        instanceof: string;
        description: string;
        link: string;
      };
      Static: {
        anyOf: (
          | {
              type: string;
              items: {
                anyOf: {
                  $ref: string;
                }[];
              };
              cli?: undefined;
              $ref?: undefined;
            }
          | {
              type: string;
              cli: {
                negatedDescription: string;
              };
              items?: undefined;
              $ref?: undefined;
            }
          | {
              $ref: string;
              type?: undefined;
              items?: undefined;
              cli?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      StaticObject: {
        type: string;
        additionalProperties: boolean;
        properties: {
          directory: {
            type: string;
            minLength: number;
            description: string;
            link: string;
          };
          staticOptions: {
            type: string;
            link: string;
            additionalProperties: boolean;
          };
          publicPath: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    type: string;
                  };
                  minItems: number;
                }
              | {
                  type: string;
                  items?: undefined;
                  minItems?: undefined;
                }
            )[];
            description: string;
            link: string;
          };
          serveIndex: {
            anyOf: (
              | {
                  type: string;
                  cli: {
                    negatedDescription: string;
                  };
                  additionalProperties?: undefined;
                }
              | {
                  type: string;
                  additionalProperties: boolean;
                  cli?: undefined;
                }
            )[];
            description: string;
            link: string;
          };
          watch: {
            anyOf: (
              | {
                  type: string;
                  cli: {
                    negatedDescription: string;
                  };
                  description?: undefined;
                  link?: undefined;
                }
              | {
                  type: string;
                  description: string;
                  link: string;
                  cli?: undefined;
                }
            )[];
            description: string;
            link: string;
          };
        };
      };
      StaticString: {
        type: string;
        minLength: number;
      };
      WatchFiles: {
        anyOf: (
          | {
              type: string;
              items: {
                anyOf: {
                  $ref: string;
                }[];
              };
              $ref?: undefined;
            }
          | {
              $ref: string;
              type?: undefined;
              items?: undefined;
            }
        )[];
        description: string;
        link: string;
      };
      WatchFilesObject: {
        cli: {
          exclude: boolean;
        };
        type: string;
        properties: {
          paths: {
            anyOf: (
              | {
                  type: string;
                  items: {
                    type: string;
                    minLength: number;
                  };
                  minLength?: undefined;
                }
              | {
                  type: string;
                  minLength: number;
                  items?: undefined;
                }
            )[];
            description: string;
          };
          options: {
            type: string;
            description: string;
            link: string;
            additionalProperties: boolean;
          };
        };
        additionalProperties: boolean;
      };
      WatchFilesString: {
        type: string;
        minLength: number;
      };
      WebSocketServer: {
        anyOf: {
          $ref: string;
        }[];
        description: string;
        link: string;
      };
      WebSocketServerType: {
        enum: string[];
      };
      WebSocketServerEnum: {
        anyOf: (
          | {
              enum: boolean[];
              cli: {
                negatedDescription: string;
              };
              $ref?: undefined;
            }
          | {
              $ref: string;
              enum?: undefined;
              cli?: undefined;
            }
        )[];
        cli: {
          description: string;
        };
      };
      WebSocketServerFunction: {
        instanceof: string;
      };
      WebSocketServerObject: {
        type: string;
        properties: {
          type: {
            anyOf: {
              $ref: string;
            }[];
          };
          options: {
            type: string;
            additionalProperties: boolean;
            cli: {
              exclude: boolean;
            };
          };
        };
        additionalProperties: boolean;
      };
      WebSocketServerString: {
        type: string;
        minLength: number;
      };
    };
    additionalProperties: boolean;
    properties: {
      allowedHosts: {
        $ref: string;
      };
      bonjour: {
        $ref: string;
      };
      client: {
        $ref: string;
      };
      compress: {
        $ref: string;
      };
      devMiddleware: {
        $ref: string;
      };
      headers: {
        $ref: string;
      };
      historyApiFallback: {
        $ref: string;
      };
      host: {
        $ref: string;
      };
      hot: {
        $ref: string;
      };
      http2: {
        $ref: string;
      };
      https: {
        $ref: string;
      };
      ipc: {
        $ref: string;
      };
      liveReload: {
        $ref: string;
      };
      magicHtml: {
        $ref: string;
      };
      onAfterSetupMiddleware: {
        $ref: string;
      };
      onBeforeSetupMiddleware: {
        $ref: string;
      };
      onListening: {
        $ref: string;
      };
      open: {
        $ref: string;
      };
      port: {
        $ref: string;
      };
      proxy: {
        $ref: string;
      };
      server: {
        $ref: string;
      };
      setupExitSignals: {
        $ref: string;
      };
      setupMiddlewares: {
        $ref: string;
      };
      static: {
        $ref: string;
      };
      watchFiles: {
        $ref: string;
      };
      webSocketServer: {
        $ref: string;
      };
    };
  };
  /**
   * @param {string} URL
   * @returns {boolean}
   */
  static isAbsoluteURL(URL: string): boolean;
  /**
   * @param {string} gateway
   * @returns {string | undefined}
   */
  static findIp(gateway: string): string | undefined;
  /**
   * @param {"v4" | "v6"} family
   * @returns {Promise<string | undefined>}
   */
  static internalIP(family: "v4" | "v6"): Promise<string | undefined>;
  /**
   * @param {"v4" | "v6"} family
   * @returns {string | undefined}
   */
  static internalIPSync(family: "v4" | "v6"): string | undefined;
  /**
   * @param {Host} hostname
   * @returns {Promise<string>}
   */
  static getHostname(hostname: Host): Promise<string>;
  /**
   * @param {Port} port
   * @param {string} host
   * @returns {Promise<number | string>}
   */
  static getFreePort(port: Port, host: string): Promise<number | string>;
  /**
   * @returns {string}
   */
  static findCacheDir(): string;
  /**
   * @private
   * @param {Compiler} compiler
   * @returns bool
   */
  private static isWebTarget;
  /**
   * @param {Configuration | Compiler | MultiCompiler} options
   * @param {Compiler | MultiCompiler | Configuration} compiler
   */
  constructor(
    options:
      | import("webpack").Compiler
      | import("webpack").MultiCompiler
      | Configuration
      | undefined,
    compiler: Compiler | MultiCompiler | Configuration
  );
  compiler: import("webpack").Compiler | import("webpack").MultiCompiler;
  /**
   * @type {ReturnType<Compiler["getInfrastructureLogger"]>}
   * */
  logger: ReturnType<Compiler["getInfrastructureLogger"]>;
  options: Configuration;
  /**
   * @type {FSWatcher[]}
   */
  staticWatchers: FSWatcher[];
  /**
   * @private
   * @type {{ name: string | symbol, listener: (...args: any[]) => void}[] }}
   */
  private listeners;
  /**
   * @private
   * @type {RequestHandler[]}
   */
  private webSocketProxies;
  /**
   * @type {Socket[]}
   */
  sockets: Socket[];
  /**
   * @private
   * @type {string | undefined}
   */
  private currentHash;
  /**
   * @private
   * @param {Compiler} compiler
   */
  private addAdditionalEntries;
  /**
   * @private
   * @returns {Compiler["options"]}
   */
  private getCompilerOptions;
  /**
   * @private
   * @returns {Promise<void>}
   */
  private normalizeOptions;
  /**
   * @private
   * @returns {string}
   */
  private getClientTransport;
  /**
   * @private
   * @returns {string}
   */
  private getServerTransport;
  /**
   * @private
   * @returns {void}
   */
  private setupProgressPlugin;
  /**
   * @private
   * @returns {Promise<void>}
   */
  private initialize;
  /**
   * @private
   * @returns {void}
   */
  private setupApp;
  /** @type {import("express").Application | undefined}*/
  app: import("express").Application | undefined;
  /**
   * @private
   * @param {Stats | MultiStats} statsObj
   * @returns {StatsCompilation}
   */
  private getStats;
  /**
   * @private
   * @returns {void}
   */
  private setupHooks;
  /**
   * @private
   * @type {Stats | MultiStats}
   */
  private stats;
  /**
   * @private
   * @returns {void}
   */
  private setupHostHeaderCheck;
  /**
   * @private
   * @returns {void}
   */
  private setupDevMiddleware;
  middleware:
    | import("webpack-dev-middleware").API<
        import("express").Request<
          import("express-serve-static-core").ParamsDictionary,
          any,
          any,
          qs.ParsedQs,
          Record<string, any>
        >,
        import("express").Response<any, Record<string, any>>
      >
    | null
    | undefined;
  /**
   * @private
   * @returns {void}
   */
  private setupBuiltInRoutes;
  /**
   * @private
   * @returns {void}
   */
  private setupWatchStaticFiles;
  /**
   * @private
   * @returns {void}
   */
  private setupWatchFiles;
  /**
   * @private
   * @returns {void}
   */
  private setupMiddlewares;
  /**
   * @private
   * @returns {void}
   */
  private createServer;
  /** @type {import("http").Server | undefined | null} */
  server: import("http").Server | undefined | null;
  /**
   * @private
   * @returns {void}
   */
  private createWebSocketServer;
  /** @type {WebSocketServerImplementation | undefined | null} */
  webSocketServer: WebSocketServerImplementation | undefined | null;
  /**
   * @private
   * @param {string} defaultOpenTarget
   * @returns {void}
   */
  private openBrowser;
  /**
   * @private
   * @returns {void}
   */
  private runBonjour;
  /**
   * @private
   * @type {Bonjour | undefined}
   */
  private bonjour;
  /**
   * @private
   * @returns {void}
   */
  private stopBonjour;
  /**
   * @private
   * @returns {void}
   */
  private logStatus;
  /**
   * @private
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  private setHeaders;
  /**
   * @private
   * @param {{ [key: string]: string | undefined }} headers
   * @param {string} headerToCheck
   * @returns {boolean}
   */
  private checkHeader;
  /**
   * @param {ClientConnection[]} clients
   * @param {string} type
   * @param {any} [data]
   * @param {any} [params]
   */
  sendMessage(
    clients: ClientConnection[],
    type: string,
    data?: any,
    params?: any
  ): void;
  /**
   * @private
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   * @returns {void}
   */
  private serveMagicHtml;
  /**
   * @private
   * @param {ClientConnection[]} clients
   * @param {StatsCompilation} stats
   * @param {boolean} [force]
   */
  private sendStats;
  /**
   * @param {string | string[]} watchPath
   * @param {WatchOptions} [watchOptions]
   */
  watchFiles(
    watchPath: string | string[],
    watchOptions?: import("chokidar").WatchOptions | undefined
  ): void;
  /**
   * @param {import("webpack-dev-middleware").Callback} [callback]
   */
  invalidate(
    callback?: import("webpack-dev-middleware").Callback | undefined
  ): void;
  /**
   * @returns {Promise<void>}
   */
  start(): Promise<void>;
  /**
   * @param {(err?: Error) => void} [callback]
   */
  startCallback(callback?: ((err?: Error) => void) | undefined): void;
  /**
   * @returns {Promise<void>}
   */
  stop(): Promise<void>;
  /**
   * @param {(err?: Error) => void} [callback]
   */
  stopCallback(callback?: ((err?: Error) => void) | undefined): void;
  /**
   * @param {Port} port
   * @param {Host} hostname
   * @param {(err?: Error) => void} fn
   * @returns {void}
   */
  listen(port: Port, hostname: Host, fn: (err?: Error) => void): void;
  /**
   * @param {(err?: Error) => void} [callback]
   * @returns {void}
   */
  close(callback?: ((err?: Error) => void) | undefined): void;
}
declare namespace Server {
  export {
    DEFAULT_STATS,
    Schema,
    Compiler,
    MultiCompiler,
    WebpackConfiguration,
    StatsOptions,
    StatsCompilation,
    Stats,
    MultiStats,
    NetworkInterfaceInfo,
    Request,
    Response,
    NextFunction,
    ExpressRequestHandler,
    ExpressErrorRequestHandler,
    WatchOptions,
    FSWatcher,
    ConnectHistoryApiFallbackOptions,
    Bonjour,
    BonjourOptions,
    RequestHandler,
    HttpProxyMiddlewareOptions,
    HttpProxyMiddlewareOptionsFilter,
    ServeIndexOptions,
    ServeStaticOptions,
    IPv4,
    IPv6,
    Socket,
    IncomingMessage,
    OpenOptions,
    ServerOptions,
    DevMiddlewareOptions,
    DevMiddlewareContext,
    Host,
    Port,
    WatchFiles,
    Static,
    NormalizedStatic,
    ServerConfiguration,
    WebSocketServerConfiguration,
    ClientConnection,
    WebSocketServer,
    WebSocketServerImplementation,
    ByPass,
    ProxyConfigArrayItem,
    ProxyConfigArray,
    ProxyConfigMap,
    OpenApp,
    Open,
    NormalizedOpen,
    WebSocketURL,
    OverlayMessageOptions,
    ClientConfiguration,
    Headers,
    Middleware,
    Configuration,
  };
}
type Compiler = import("webpack").Compiler;
type Configuration = {
  ipc?: string | boolean | undefined;
  host?: string | undefined;
  port?: Port | undefined;
  hot?: boolean | "only" | undefined;
  liveReload?: boolean | undefined;
  devMiddleware?:
    | DevMiddlewareOptions<
        import("express").Request<
          import("express-serve-static-core").ParamsDictionary,
          any,
          any,
          qs.ParsedQs,
          Record<string, any>
        >,
        import("express").Response<any, Record<string, any>>
      >
    | undefined;
  compress?: boolean | undefined;
  magicHtml?: boolean | undefined;
  allowedHosts?: string | string[] | undefined;
  historyApiFallback?:
    | boolean
    | import("connect-history-api-fallback").Options
    | undefined;
  bonjour?:
    | boolean
    | Record<string, never>
    | import("bonjour-service").Service
    | undefined;
  watchFiles?:
    | string
    | string[]
    | WatchFiles
    | (string | WatchFiles)[]
    | undefined;
  static?: string | boolean | Static | (string | Static)[] | undefined;
  https?: boolean | ServerOptions | undefined;
  http2?: boolean | undefined;
  server?: string | ServerConfiguration | undefined;
  webSocketServer?: string | boolean | WebSocketServerConfiguration | undefined;
  proxy?: ProxyConfigArrayItem | ProxyConfigMap | ProxyConfigArray | undefined;
  open?: string | boolean | Open | (string | Open)[] | undefined;
  setupExitSignals?: boolean | undefined;
  client?: boolean | ClientConfiguration | undefined;
  headers?:
    | Headers
    | ((
        req: Request,
        res: Response,
        context: DevMiddlewareContext<Request, Response>
      ) => Headers)
    | undefined;
  onAfterSetupMiddleware?: ((devServer: Server) => void) | undefined;
  onBeforeSetupMiddleware?: ((devServer: Server) => void) | undefined;
  onListening?: ((devServer: Server) => void) | undefined;
  setupMiddlewares?:
    | ((middlewares: Middleware[], devServer: Server) => Middleware[])
    | undefined;
};
type FSWatcher = import("chokidar").FSWatcher;
type Socket = import("net").Socket;
type WebSocketServerImplementation = {
  implementation: WebSocketServer;
  clients: ClientConnection[];
};
type ClientConnection = (
  | import("ws").WebSocket
  | (import("sockjs").Connection & {
      send: import("ws").WebSocket["send"];
      terminate: import("ws").WebSocket["terminate"];
      ping: import("ws").WebSocket["ping"];
    })
) & {
  isAlive?: boolean;
};
type Port = number | string | "auto";
type Host = "local-ip" | "local-ipv4" | "local-ipv6" | string;
type MultiCompiler = import("webpack").MultiCompiler;
declare class DEFAULT_STATS {
  private constructor();
}
type Schema = import("schema-utils/declarations/validate").Schema;
type WebpackConfiguration = import("webpack").Configuration;
type StatsOptions = import("webpack").StatsOptions;
type StatsCompilation = import("webpack").StatsCompilation;
type Stats = import("webpack").Stats;
type MultiStats = import("webpack").MultiStats;
type NetworkInterfaceInfo = import("os").NetworkInterfaceInfo;
type Request = import("express").Request;
type Response = import("express").Response;
type NextFunction = import("express").NextFunction;
type ExpressRequestHandler = import("express").RequestHandler;
type ExpressErrorRequestHandler = import("express").ErrorRequestHandler;
type WatchOptions = import("chokidar").WatchOptions;
type ConnectHistoryApiFallbackOptions =
  import("connect-history-api-fallback").Options;
type Bonjour = import("bonjour-service").Bonjour;
type BonjourOptions = import("bonjour-service").Service;
type RequestHandler = import("http-proxy-middleware").RequestHandler;
type HttpProxyMiddlewareOptions = import("http-proxy-middleware").Options;
type HttpProxyMiddlewareOptionsFilter = import("http-proxy-middleware").Filter;
type ServeIndexOptions = import("serve-index").Options;
type ServeStaticOptions = import("serve-static").ServeStaticOptions;
type IPv4 = import("ipaddr.js").IPv4;
type IPv6 = import("ipaddr.js").IPv6;
type IncomingMessage = import("http").IncomingMessage;
type OpenOptions = import("open").Options;
type ServerOptions = import("https").ServerOptions & {
  spdy?: {
    plain?: boolean | undefined;
    ssl?: boolean | undefined;
    "x-forwarded-for"?: string | undefined;
    protocol?: string | undefined;
    protocols?: string[] | undefined;
  };
};
type DevMiddlewareOptions<Request_1, Response_1> =
  import("webpack-dev-middleware").Options<Request, Response>;
type DevMiddlewareContext<Request_1, Response_1> =
  import("webpack-dev-middleware").Context<Request, Response>;
type WatchFiles = {
  paths: string | string[];
  options?:
    | (import("chokidar").WatchOptions & {
        aggregateTimeout?: number | undefined;
        ignored?: WatchOptions["ignored"];
        poll?: number | boolean | undefined;
      })
    | undefined;
};
type Static = {
  directory?: string | undefined;
  publicPath?: string | string[] | undefined;
  serveIndex?: boolean | import("serve-index").Options | undefined;
  staticOptions?:
    | import("serve-static").ServeStaticOptions<
        import("http").ServerResponse<import("http").IncomingMessage>
      >
    | undefined;
  watch?:
    | boolean
    | (import("chokidar").WatchOptions & {
        aggregateTimeout?: number | undefined;
        ignored?: WatchOptions["ignored"];
        poll?: number | boolean | undefined;
      })
    | undefined;
};
type NormalizedStatic = {
  directory: string;
  publicPath: string[];
  serveIndex: false | ServeIndexOptions;
  staticOptions: ServeStaticOptions;
  watch: false | WatchOptions;
};
type ServerConfiguration = {
  type?: string | undefined;
  options?: ServerOptions | undefined;
};
type WebSocketServerConfiguration = {
  type?: string | Function | undefined;
  options?: Record<string, any> | undefined;
};
type WebSocketServer =
  | import("ws").WebSocketServer
  | (import("sockjs").Server & {
      close: import("ws").WebSocketServer["close"];
    });
type ByPass = (
  req: Request,
  res: Response,
  proxyConfig: ProxyConfigArrayItem
) => any;
type ProxyConfigArrayItem = {
  path?: HttpProxyMiddlewareOptionsFilter | undefined;
  context?: HttpProxyMiddlewareOptionsFilter | undefined;
} & {
  bypass?: ByPass;
} & HttpProxyMiddlewareOptions;
type ProxyConfigArray = (
  | ProxyConfigArrayItem
  | ((
      req?: Request | undefined,
      res?: Response | undefined,
      next?: NextFunction | undefined
    ) => ProxyConfigArrayItem)
)[];
type ProxyConfigMap = {
  [url: string]: string | ProxyConfigArrayItem;
};
type OpenApp = {
  name?: string | undefined;
  arguments?: string[] | undefined;
};
type Open = {
  app?: string | string[] | OpenApp | undefined;
  target?: string | string[] | undefined;
};
type NormalizedOpen = {
  target: string;
  options: import("open").Options;
};
type WebSocketURL = {
  hostname?: string | undefined;
  password?: string | undefined;
  pathname?: string | undefined;
  port?: string | number | undefined;
  protocol?: string | undefined;
  username?: string | undefined;
};
type OverlayMessageOptions = boolean | ((error: Error) => void);
type ClientConfiguration = {
  logging?: "none" | "error" | "warn" | "info" | "log" | "verbose" | undefined;
  overlay?:
    | boolean
    | {
        warnings?: OverlayMessageOptions | undefined;
        errors?: OverlayMessageOptions | undefined;
        runtimeErrors?: OverlayMessageOptions | undefined;
      }
    | undefined;
  progress?: boolean | undefined;
  reconnect?: number | boolean | undefined;
  webSocketTransport?: string | undefined;
  webSocketURL?: string | WebSocketURL | undefined;
};
type Headers =
  | Array<{
      key: string;
      value: string;
    }>
  | Record<string, string | string[]>;
type Middleware =
  | {
      name?: string;
      path?: string;
      middleware: ExpressRequestHandler | ExpressErrorRequestHandler;
    }
  | ExpressRequestHandler
  | ExpressErrorRequestHandler;
import path = require("path");

// DO NOT REMOVE THIS!
type DevServerConfiguration = Configuration;
declare module "webpack" {
  interface Configuration {
    /**
     * Can be used to configure the behaviour of webpack-dev-server when
     * the webpack config is passed to webpack-dev-server CLI.
     */
    devServer?: DevServerConfiguration | undefined;
  }
}
