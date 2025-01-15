"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StyleInineLoader = function (source) {
    // TODO minify this?
    return `export default ${JSON.stringify(source)}`;
};
exports.default = StyleInineLoader;
