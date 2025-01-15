function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
import SockJS from "../modules/sockjs-client/index.js";
import { log } from "../utils/log.js";
var SockJSClient = /*#__PURE__*/function () {
  /**
   * @param {string} url
   */
  function SockJSClient(url) {
    _classCallCheck(this, SockJSClient);
    // SockJS requires `http` and `https` protocols
    this.sock = new SockJS(url.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:"));
    this.sock.onerror =
    /**
     * @param {Error} error
     */
    function (error) {
      log.error(error);
    };
  }

  /**
   * @param {(...args: any[]) => void} f
   */
  _createClass(SockJSClient, [{
    key: "onOpen",
    value: function onOpen(f) {
      this.sock.onopen = f;
    }

    /**
     * @param {(...args: any[]) => void} f
     */
  }, {
    key: "onClose",
    value: function onClose(f) {
      this.sock.onclose = f;
    }

    // call f with the message string as the first argument
    /**
     * @param {(...args: any[]) => void} f
     */
  }, {
    key: "onMessage",
    value: function onMessage(f) {
      this.sock.onmessage =
      /**
       * @param {Error & { data: string }} e
       */
      function (e) {
        f(e.data);
      };
    }
  }]);
  return SockJSClient;
}();
export { SockJSClient as default };