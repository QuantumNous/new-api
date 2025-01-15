export = SockJSServer;
declare class SockJSServer extends BaseServer {
  implementation: sockjs.Server;
}
declare namespace SockJSServer {
  export { WebSocketServerConfiguration, ClientConnection };
}
import BaseServer = require("./BaseServer");
import sockjs = require("sockjs");
type WebSocketServerConfiguration =
  import("../Server").WebSocketServerConfiguration;
type ClientConnection = import("../Server").ClientConnection;
