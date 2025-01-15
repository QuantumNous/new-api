"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const NS = 'vue-loader';
class Plugin {
    apply(compiler) {
        let Ctor;
        if ((0, util_1.testWebpack5)(compiler)) {
            // webpack5 and upper
            Ctor = require('./pluginWebpack5').default;
        }
        else {
            // webpack4 and lower
            Ctor = require('./pluginWebpack4').default;
        }
        new Ctor().apply(compiler);
    }
}
Plugin.NS = NS;
exports.default = Plugin;
