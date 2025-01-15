"use strict";

const sockjs = require("sockjs");
const BaseServer = require("./BaseServer");

/** @typedef {import("../Server").WebSocketServerConfiguration} WebSocketServerConfiguration */
/** @typedef {import("../Server").ClientConnection} ClientConnection */

// Workaround for sockjs@~0.3.19
// sockjs will remove Origin header, however Origin header is required for checking host.
// See https://github.com/webpack/webpack-dev-server/issues/1604 for more information
{
  // @ts-ignore
  const SockjsSession = require("sockjs/lib/transport").Session;
  const decorateConnection = SockjsSession.prototype.decorateConnection;

  /**
   * @param {import("http").IncomingMessage} req
   */
  // eslint-disable-next-line func-names
  SockjsSession.prototype.decorateConnection = function (req) {
    decorateConnection.call(this, req);

    const connection = this.connection;

    if (
      connection.headers &&
      !("origin" in connection.headers) &&
      "origin" in req.headers
    ) {
      connection.headers.origin = req.headers.origin;
    }
  };
}

module.exports = class SockJSServer extends BaseServer {
  // options has: error (function), debug (function), server (http/s server), path (string)
  /**
   * @param {import("../Server")} server
   */
  constructor(server) {
    super(server);

    const webSocketServerOptions =
      /** @type {NonNullable<WebSocketServerConfiguration["options"]>} */
      (
        /** @type {WebSocketServerConfiguration} */
        (this.server.options.webSocketServer).options
      );

    /**
     * @param {NonNullable<WebSocketServerConfiguration["options"]>} options
     * @returns {string}
     */
    const getSockjsUrl = (options) => {
      if (typeof options.sockjsUrl !== "undefined") {
        return options.sockjsUrl;
      }

      return "/__webpack_dev_server__/sockjs.bundle.js";
    };

    this.implementation = sockjs.createServer({
      // Use provided up-to-date sockjs-client
      sockjs_url: getSockjsUrl(webSocketServerOptions),
      // Default logger is very annoy. Limit useless logs.
      /**
       * @param {string} severity
       * @param {string} line
       */
      log: (severity, line) => {
        if (severity === "error") {
          this.server.logger.error(line);
        } else if (severity === "info") {
          this.server.logger.log(line);
        } else {
          this.server.logger.debug(line);
        }
      },
    });

    /**
     * @param {import("sockjs").ServerOptions & { path?: string }} options
     * @returns {string | undefined}
     */
    const getPrefix = (options) => {
      if (typeof options.prefix !== "undefined") {
        return options.prefix;
      }

      return options.path;
    };

    const options = {
      ...webSocketServerOptions,
      prefix: getPrefix(webSocketServerOptions),
    };

    this.implementation.installHandlers(
      /** @type {import("http").Server} */ (this.server.server),
      options
    );

    this.implementation.on("connection", (client) => {
      // @ts-ignore
      // Implement the the same API as for `ws`
      client.send = client.write;
      // @ts-ignore
      client.terminate = client.close;

      this.clients.push(/** @type {ClientConnection} */ (client));

      client.on("close", () => {
        this.clients.splice(
          this.clients.indexOf(/** @type {ClientConnection} */ (client)),
          1
        );
      });
    });

    // @ts-ignore
    this.implementation.close = (callback) => {
      callback();
    };
  }
};
