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
const formatError_1 = require("./formatError");
const descriptorCache_1 = require("./descriptorCache");
const resolveScript_1 = require("./resolveScript");
const util_1 = require("./util");
const compiler_1 = require("./compiler");
const { compileTemplate } = compiler_1.compiler;
// Loader that compiles raw template into JavaScript functions.
// This is injected by the global pitcher (../pitch) for template
// selection requests initiated from vue files.
const TemplateLoader = function (source, inMap) {
    var _a;
    source = String(source);
    const loaderContext = this;
    // although this is not the main vue-loader, we can get access to the same
    // vue-loader options because we've set an ident in the plugin and used that
    // ident to create the request for this loader in the pitcher.
    const options = ((0, util_1.getOptions)(loaderContext) || {});
    const isServer = (_a = options.isServerBuild) !== null && _a !== void 0 ? _a : loaderContext.target === 'node';
    const isProd = loaderContext.mode === 'production' || process.env.NODE_ENV === 'production';
    const query = qs.parse(loaderContext.resourceQuery.slice(1));
    const scopeId = query.id;
    const descriptor = (0, descriptorCache_1.getDescriptor)(loaderContext.resourcePath);
    const script = (0, resolveScript_1.resolveScript)(descriptor, query.id, options, loaderContext);
    let templateCompiler;
    if (typeof options.compiler === 'string') {
        templateCompiler = require(options.compiler);
    }
    else {
        templateCompiler = options.compiler;
    }
    const compiled = compileTemplate({
        source,
        filename: loaderContext.resourcePath,
        inMap,
        id: scopeId,
        scoped: !!query.scoped,
        slotted: descriptor.slotted,
        isProd,
        ssr: isServer,
        ssrCssVars: descriptor.cssVars,
        compiler: templateCompiler,
        compilerOptions: Object.assign(Object.assign(Object.assign({}, options.compilerOptions), { scopeId: query.scoped ? `data-v-${scopeId}` : undefined, bindingMetadata: script ? script.bindings : undefined }), (0, util_1.resolveTemplateTSOptions)(descriptor, options)),
        transformAssetUrls: options.transformAssetUrls || true,
    });
    // tips
    if (compiled.tips.length) {
        compiled.tips.forEach((tip) => {
            loaderContext.emitWarning(new Error(tip));
        });
    }
    // errors
    if (compiled.errors && compiled.errors.length) {
        compiled.errors.forEach((err) => {
            if (typeof err === 'string') {
                loaderContext.emitError(new Error(err));
            }
            else {
                (0, formatError_1.formatError)(err, inMap ? inMap.sourcesContent[0] : source, loaderContext.resourcePath);
                loaderContext.emitError(err);
            }
        });
    }
    const { code, map } = compiled;
    loaderContext.callback(null, code, map);
};
exports.default = TemplateLoader;
