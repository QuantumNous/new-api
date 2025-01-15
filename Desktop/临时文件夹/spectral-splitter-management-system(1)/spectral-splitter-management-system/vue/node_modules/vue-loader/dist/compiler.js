"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compiler = void 0;
try {
    // Vue 3.2.13+ ships the SFC compiler directly under the `vue` package
    // making it no longer necessary to have @vue/compiler-sfc separately installed.
    exports.compiler = require('vue/compiler-sfc');
}
catch (e) {
    try {
        exports.compiler = require('@vue/compiler-sfc');
    }
    catch (e) {
        throw new Error(`@vitejs/plugin-vue requires vue (>=3.2.13) or @vue/compiler-sfc ` +
            `to be present in the dependency tree.`);
    }
}
