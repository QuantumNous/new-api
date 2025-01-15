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
exports.getDescriptor = exports.setDescriptor = exports.descriptorCache = void 0;
const fs = __importStar(require("fs"));
const compiler_1 = require("./compiler");
const { parse } = compiler_1.compiler;
exports.descriptorCache = new Map();
function setDescriptor(filename, entry) {
    exports.descriptorCache.set(cleanQuery(filename), entry);
}
exports.setDescriptor = setDescriptor;
function getDescriptor(filename) {
    filename = cleanQuery(filename);
    if (exports.descriptorCache.has(filename)) {
        return exports.descriptorCache.get(filename);
    }
    // This function should only be called after the descriptor has been
    // cached by the main loader.
    // If this is somehow called without a cache hit, it's probably due to sub
    // loaders being run in separate threads. The only way to deal with this is to
    // read from disk directly...
    const source = fs.readFileSync(filename, 'utf-8');
    const { descriptor } = parse(source, {
        filename,
        sourceMap: true,
    });
    exports.descriptorCache.set(filename, descriptor);
    return descriptor;
}
exports.getDescriptor = getDescriptor;
function cleanQuery(str) {
    const i = str.indexOf('?');
    return i > 0 ? str.slice(0, i) : str;
}
