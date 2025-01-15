"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveScript = exports.canInlineTemplate = exports.typeDepToSFCMap = exports.clientCache = void 0;
const util_1 = require("./util");
const compiler_1 = require("./compiler");
const { compileScript } = compiler_1.compiler;
exports.clientCache = new WeakMap();
const serverCache = new WeakMap();
exports.typeDepToSFCMap = new Map();
/**
 * inline template mode can only be enabled if:
 * - is production (separate compilation needed for HMR during dev)
 * - template has no pre-processor (separate loader chain required)
 * - template is not using src
 */
function canInlineTemplate(descriptor, isProd) {
    const templateLang = descriptor.template && descriptor.template.lang;
    const templateSrc = descriptor.template && descriptor.template.src;
    return isProd && !!descriptor.scriptSetup && !templateLang && !templateSrc;
}
exports.canInlineTemplate = canInlineTemplate;
function resolveScript(descriptor, scopeId, options, loaderContext) {
    var _a;
    if (!descriptor.script && !descriptor.scriptSetup) {
        return null;
    }
    const isProd = loaderContext.mode === 'production' || process.env.NODE_ENV === 'production';
    const isServer = (_a = options.isServerBuild) !== null && _a !== void 0 ? _a : loaderContext.target === 'node';
    const enableInline = canInlineTemplate(descriptor, isProd);
    const cacheToUse = isServer ? serverCache : exports.clientCache;
    const cached = cacheToUse.get(descriptor);
    if (cached) {
        return cached;
    }
    let resolved = null;
    let templateCompiler;
    if (typeof options.compiler === 'string') {
        templateCompiler = require(options.compiler);
    }
    else {
        templateCompiler = options.compiler;
    }
    try {
        resolved = compileScript(descriptor, {
            id: scopeId,
            isProd,
            inlineTemplate: enableInline,
            reactivityTransform: options.reactivityTransform,
            propsDestructure: options.propsDestructure,
            defineModel: options.defineModel,
            babelParserPlugins: options.babelParserPlugins,
            templateOptions: {
                ssr: isServer,
                compiler: templateCompiler,
                compilerOptions: Object.assign(Object.assign({}, options.compilerOptions), (0, util_1.resolveTemplateTSOptions)(descriptor, options)),
                transformAssetUrls: options.transformAssetUrls || true,
            },
        });
    }
    catch (e) {
        loaderContext.emitError(e);
    }
    if (!isProd && (resolved === null || resolved === void 0 ? void 0 : resolved.deps)) {
        for (const [key, sfcs] of exports.typeDepToSFCMap) {
            if (sfcs.has(descriptor.filename) && !resolved.deps.includes(key)) {
                sfcs.delete(descriptor.filename);
                if (!sfcs.size) {
                    exports.typeDepToSFCMap.delete(key);
                }
            }
        }
        for (const dep of resolved.deps) {
            const existingSet = exports.typeDepToSFCMap.get(dep);
            if (!existingSet) {
                exports.typeDepToSFCMap.set(dep, new Set([descriptor.filename]));
            }
            else {
                existingSet.add(descriptor.filename);
            }
        }
    }
    cacheToUse.set(descriptor, resolved);
    return resolved;
}
exports.resolveScript = resolveScript;
