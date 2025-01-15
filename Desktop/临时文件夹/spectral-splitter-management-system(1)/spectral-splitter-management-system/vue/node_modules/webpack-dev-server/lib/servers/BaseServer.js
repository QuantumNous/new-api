"use strict";

/** @typedef {import("../Server").ClientConnection} ClientConnection */

// base class that users should extend if they are making their own
// server implementation
module.exports = class BaseServer {
  /**
   * @param {import("../Server")} server
   */
  constructor(server) {
    /** @type {import("../Server")} */
    this.server = server;

    /** @type {ClientConnection[]} */
    this.clients = [];
  }
};
