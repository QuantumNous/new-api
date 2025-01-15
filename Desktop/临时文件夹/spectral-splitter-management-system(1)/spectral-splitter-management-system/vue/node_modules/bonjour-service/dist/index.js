"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Browser = exports.Service = exports.Bonjour = void 0;
const registry_1 = __importDefault(require("./lib/registry"));
const mdns_server_1 = __importDefault(require("./lib/mdns-server"));
const browser_1 = __importDefault(require("./lib/browser"));
exports.Browser = browser_1.default;
const service_1 = __importDefault(require("./lib/service"));
exports.Service = service_1.default;
class Bonjour {
    constructor(opts, errorCallback) {
        this.server = new mdns_server_1.default(opts, errorCallback);
        this.registry = new registry_1.default(this.server);
    }
    publish(opts) {
        return this.registry.publish(opts);
    }
    unpublishAll(callback) {
        return this.registry.unpublishAll(callback);
    }
    find(opts = undefined, onup) {
        return new browser_1.default(this.server.mdns, opts, onup);
    }
    findOne(opts = undefined, timeout = 10000, callback) {
        const browser = new browser_1.default(this.server.mdns, opts);
        var timer;
        browser.once('up', (service) => {
            if (timer !== undefined)
                clearTimeout(timer);
            browser.stop();
            if (callback)
                callback(service);
        });
        timer = setTimeout(() => {
            browser.stop();
            if (callback)
                callback(null);
        }, timeout);
        return browser;
    }
    destroy() {
        this.registry.destroy();
        this.server.mdns.destroy();
    }
}
exports.Bonjour = Bonjour;
exports.default = Bonjour;
//# sourceMappingURL=index.js.map