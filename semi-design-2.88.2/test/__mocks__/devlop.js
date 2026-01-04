var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
    for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// devlop.js
var devlop_exports = {};
__export(devlop_exports, {
    deprecate: () => deprecate,
    equal: () => equal,
    ok: () => ok,
    unreachable: () => unreachable
});
module.exports = __toCommonJS(devlop_exports);

// node_modules/devlop/lib/default.js
function deprecate(fn) {
    return fn;
}
function equal() {
}
function ok() {
}
function unreachable() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
    deprecate,
    equal,
    ok,
    unreachable
});