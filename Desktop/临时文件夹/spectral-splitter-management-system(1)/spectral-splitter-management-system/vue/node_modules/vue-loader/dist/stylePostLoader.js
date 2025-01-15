"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const qs = __importStar(require("querystring"));
const compiler_1 = require("./compiler");
const { compileStyle } = compiler_1.compiler;
// This is a post loader that handles scoped CSS transforms.
// Injected right before css-loader by the global pitcher (../pitch.js)
// for any <style scoped> selection requests initiated from within vue files.
const StylePostLoader = function (source, inMap) {
    const query = qs.parse(this.resourceQuery.slice(1));
    // skip normal CSS files without scoped flag
    if (!('vue' in query) ||
        query.type !== 'style' ||
        !query.id ||
        !query.scoped) {
        this.callback(null, source, inMap);
        return;
    }
    const { code, map, errors } = compileStyle({
        source: source,
        filename: this.resourcePath,
        id: `data-v-${query.id}`,
        map: inMap,
        scoped: !!query.scoped,
        trim: true,
        isProd: this.mode === 'production' || process.env.NODE_ENV === 'production',
    });
    if (errors.length) {
        this.callback(errors[0]);
    }
    else {
        this.callback(null, code, map);
    }
};
exports.default = StylePostLoader;
