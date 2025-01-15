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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWebpack5 = exports.genMatchResource = exports.stringifyRequest = exports.getOptions = exports.resolveTemplateTSOptions = exports.needHMR = void 0;
const querystring_1 = __importDefault(require("querystring"));
const path = __importStar(require("path"));
function needHMR(vueLoaderOptions, compilerOptions) {
    var _a;
    const isServer = (_a = vueLoaderOptions.isServerBuild) !== null && _a !== void 0 ? _a : compilerOptions.target === 'node';
    const isProduction = compilerOptions.mode === 'production' ||
        process.env.NODE_ENV === 'production';
    return !isServer && !isProduction && vueLoaderOptions.hotReload !== false;
}
exports.needHMR = needHMR;
function resolveTemplateTSOptions(descriptor, options) {
    var _a, _b, _c;
    if (options.enableTsInTemplate === false)
        return null;
    const lang = ((_a = descriptor.script) === null || _a === void 0 ? void 0 : _a.lang) || ((_b = descriptor.scriptSetup) === null || _b === void 0 ? void 0 : _b.lang);
    const isTS = !!(lang && /tsx?$/.test(lang));
    let expressionPlugins = ((_c = options === null || options === void 0 ? void 0 : options.compilerOptions) === null || _c === void 0 ? void 0 : _c.expressionPlugins) || [];
    if (isTS && !expressionPlugins.includes('typescript')) {
        expressionPlugins = [...expressionPlugins, 'typescript'];
    }
    return {
        isTS,
        expressionPlugins,
    };
}
exports.resolveTemplateTSOptions = resolveTemplateTSOptions;
// loader utils removed getOptions in 3.x, but it's not available on webpack 4
// loader context
function getOptions(loaderContext) {
    const query = loaderContext.query;
    if (typeof query === 'string' && query !== '') {
        return parseQuery(query);
    }
    if (!query || typeof query !== 'object') {
        // Not object-like queries are not supported.
        return {};
    }
    return query;
}
exports.getOptions = getOptions;
const specialValues = {
    null: null,
    true: true,
    false: false,
};
function parseQuery(query) {
    if (query.substr(0, 1) !== '?') {
        throw new Error("A valid query string passed to parseQuery should begin with '?'");
    }
    query = query.substr(1);
    if (!query) {
        return {};
    }
    if (query.substr(0, 1) === '{' && query.substr(-1) === '}') {
        return JSON.parse(query);
    }
    const queryArgs = query.split(/[,&]/g);
    const result = Object.create(null);
    queryArgs.forEach((arg) => {
        const idx = arg.indexOf('=');
        if (idx >= 0) {
            let name = arg.substr(0, idx);
            let value = decodeURIComponent(arg.substr(idx + 1));
            // eslint-disable-next-line no-prototype-builtins
            if (specialValues.hasOwnProperty(value)) {
                value = specialValues[value];
            }
            if (name.substr(-2) === '[]') {
                name = decodeURIComponent(name.substr(0, name.length - 2));
                if (!Array.isArray(result[name])) {
                    result[name] = [];
                }
                result[name].push(value);
            }
            else {
                name = decodeURIComponent(name);
                result[name] = value;
            }
        }
        else {
            if (arg.substr(0, 1) === '-') {
                result[decodeURIComponent(arg.substr(1))] = false;
            }
            else if (arg.substr(0, 1) === '+') {
                result[decodeURIComponent(arg.substr(1))] = true;
            }
            else {
                result[decodeURIComponent(arg)] = true;
            }
        }
    });
    return result;
}
const matchRelativePath = /^\.\.?[/\\]/;
function isAbsolutePath(str) {
    return path.posix.isAbsolute(str) || path.win32.isAbsolute(str);
}
function isRelativePath(str) {
    return matchRelativePath.test(str);
}
function stringifyRequest(loaderContext, request) {
    const splitted = request.split('!');
    const context = loaderContext.context ||
        // @ts-ignore
        (loaderContext.options && loaderContext.options.context);
    return JSON.stringify(splitted
        .map((part) => {
        // First, separate singlePath from query, because the query might contain paths again
        const splittedPart = part.match(/^(.*?)(\?.*)/);
        const query = splittedPart ? splittedPart[2] : '';
        let singlePath = splittedPart ? splittedPart[1] : part;
        if (isAbsolutePath(singlePath) && context) {
            singlePath = path.relative(context, singlePath);
            if (isAbsolutePath(singlePath)) {
                // If singlePath still matches an absolute path, singlePath was on a different drive than context.
                // In this case, we leave the path platform-specific without replacing any separators.
                // @see https://github.com/webpack/loader-utils/pull/14
                return singlePath + query;
            }
            if (isRelativePath(singlePath) === false) {
                // Ensure that the relative path starts at least with ./ otherwise it would be a request into the modules directory (like node_modules).
                singlePath = './' + singlePath;
            }
        }
        return singlePath.replace(/\\/g, '/') + query;
    })
        .join('!'));
}
exports.stringifyRequest = stringifyRequest;
function genMatchResource(context, resourcePath, resourceQuery, lang) {
    resourceQuery = resourceQuery || '';
    const loaders = [];
    const parsedQuery = querystring_1.default.parse(resourceQuery.slice(1));
    // process non-external resources
    if ('vue' in parsedQuery && !('external' in parsedQuery)) {
        const currentRequest = context.loaders
            .slice(context.loaderIndex)
            .map((obj) => obj.request);
        loaders.push(...currentRequest);
    }
    const loaderString = loaders.join('!');
    return `${resourcePath}${lang ? `.${lang}` : ''}${resourceQuery}!=!${loaderString ? `${loaderString}!` : ''}${resourcePath}${resourceQuery}`;
}
exports.genMatchResource = genMatchResource;
const testWebpack5 = (compiler) => {
    var _a;
    if (!compiler) {
        return false;
    }
    const webpackVersion = (_a = compiler === null || compiler === void 0 ? void 0 : compiler.webpack) === null || _a === void 0 ? void 0 : _a.version;
    return Boolean(webpackVersion && Number(webpackVersion.split('.')[0]) > 4);
};
exports.testWebpack5 = testWebpack5;
