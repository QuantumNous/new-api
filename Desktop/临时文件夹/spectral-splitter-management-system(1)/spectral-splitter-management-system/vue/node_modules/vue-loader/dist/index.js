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
exports.VueLoaderPlugin = void 0;
const path = __importStar(require("path"));
const qs = __importStar(require("querystring"));
const hash = require("hash-sum");
const compiler_1 = require("./compiler");
const select_1 = require("./select");
const hotReload_1 = require("./hotReload");
const cssModules_1 = require("./cssModules");
const formatError_1 = require("./formatError");
const plugin_1 = __importDefault(require("./plugin"));
exports.VueLoaderPlugin = plugin_1.default;
const resolveScript_1 = require("./resolveScript");
const descriptorCache_1 = require("./descriptorCache");
const util_1 = require("./util");
let errorEmitted = false;
const { parse } = compiler_1.compiler;
const exportHelperPath = require.resolve('./exportHelper');
function loader(source) {
    var _a;
    const loaderContext = this;
    // check if plugin is installed
    if (!errorEmitted &&
        !loaderContext['thread-loader'] &&
        !loaderContext[plugin_1.default.NS]) {
        loaderContext.emitError(new Error(`vue-loader was used without the corresponding plugin. ` +
            `Make sure to include VueLoaderPlugin in your webpack config.`));
        errorEmitted = true;
    }
    const stringifyRequest = (r) => (0, util_1.stringifyRequest)(loaderContext, r);
    const { mode, target, sourceMap, rootContext, resourcePath, resourceQuery: _resourceQuery = '', _compiler, } = loaderContext;
    const isWebpack5 = (0, util_1.testWebpack5)(_compiler);
    const rawQuery = _resourceQuery.slice(1);
    const incomingQuery = qs.parse(rawQuery);
    const resourceQuery = rawQuery ? `&${rawQuery}` : '';
    const options = ((0, util_1.getOptions)(loaderContext) || {});
    const enableInlineMatchResource = isWebpack5 && Boolean(options.experimentalInlineMatchResource);
    const isServer = (_a = options.isServerBuild) !== null && _a !== void 0 ? _a : target === 'node';
    const isProduction = mode === 'production' || process.env.NODE_ENV === 'production';
    const filename = resourcePath.replace(/\?.*$/, '');
    const { descriptor, errors } = parse(source, {
        filename,
        sourceMap,
    });
    const asCustomElement = typeof options.customElement === 'boolean'
        ? options.customElement
        : (options.customElement || /\.ce\.vue$/).test(filename);
    // cache descriptor
    (0, descriptorCache_1.setDescriptor)(filename, descriptor);
    if (errors.length) {
        errors.forEach((err) => {
            (0, formatError_1.formatError)(err, source, resourcePath);
            loaderContext.emitError(err);
        });
        return ``;
    }
    // module id for scoped CSS & hot-reload
    const rawShortFilePath = path
        .relative(rootContext || process.cwd(), filename)
        .replace(/^(\.\.[\/\\])+/, '');
    const shortFilePath = rawShortFilePath.replace(/\\/g, '/');
    const id = hash(isProduction
        ? shortFilePath + '\n' + source.replace(/\r\n/g, '\n')
        : shortFilePath);
    // if the query has a type field, this is a language block request
    // e.g. foo.vue?type=template&id=xxxxx
    // and we will return early
    if (incomingQuery.type) {
        return (0, select_1.selectBlock)(descriptor, id, options, loaderContext, incomingQuery, !!options.appendExtension);
    }
    // feature information
    const hasScoped = descriptor.styles.some((s) => s.scoped);
    const needsHotReload = !isServer &&
        !isProduction &&
        !!(descriptor.script || descriptor.scriptSetup || descriptor.template) &&
        options.hotReload !== false;
    // extra properties to attach to the script object
    // we need to do this in a tree-shaking friendly manner
    const propsToAttach = [];
    // script
    let scriptImport = `const script = {}`;
    let isTS = false;
    const { script, scriptSetup } = descriptor;
    if (script || scriptSetup) {
        const lang = (script === null || script === void 0 ? void 0 : script.lang) || (scriptSetup === null || scriptSetup === void 0 ? void 0 : scriptSetup.lang);
        isTS = !!(lang && /tsx?/.test(lang));
        const externalQuery = Boolean(script && !scriptSetup && script.src)
            ? `&external`
            : ``;
        const src = (script && !scriptSetup && script.src) || resourcePath;
        const attrsQuery = attrsToQuery((scriptSetup || script).attrs, 'js');
        const query = `?vue&type=script${attrsQuery}${resourceQuery}${externalQuery}`;
        let scriptRequest;
        if (enableInlineMatchResource) {
            scriptRequest = stringifyRequest((0, util_1.genMatchResource)(this, src, query, lang || 'js'));
        }
        else {
            scriptRequest = stringifyRequest(src + query);
        }
        scriptImport =
            `import script from ${scriptRequest}\n` +
                // support named exports
                `export * from ${scriptRequest}`;
    }
    // template
    let templateImport = ``;
    let templateRequest;
    const renderFnName = isServer ? `ssrRender` : `render`;
    const useInlineTemplate = (0, resolveScript_1.canInlineTemplate)(descriptor, isProduction);
    if (descriptor.template && !useInlineTemplate) {
        const src = descriptor.template.src || resourcePath;
        const externalQuery = Boolean(descriptor.template.src) ? `&external` : ``;
        const idQuery = `&id=${id}`;
        const scopedQuery = hasScoped ? `&scoped=true` : ``;
        const attrsQuery = attrsToQuery(descriptor.template.attrs);
        const tsQuery = options.enableTsInTemplate !== false && isTS ? `&ts=true` : ``;
        const query = `?vue&type=template${idQuery}${scopedQuery}${tsQuery}${attrsQuery}${resourceQuery}${externalQuery}`;
        if (enableInlineMatchResource) {
            templateRequest = stringifyRequest((0, util_1.genMatchResource)(this, src, query, options.enableTsInTemplate !== false && isTS ? 'ts' : 'js'));
        }
        else {
            templateRequest = stringifyRequest(src + query);
        }
        templateImport = `import { ${renderFnName} } from ${templateRequest}`;
        propsToAttach.push([renderFnName, renderFnName]);
    }
    // styles
    let stylesCode = ``;
    let hasCSSModules = false;
    const nonWhitespaceRE = /\S+/;
    if (descriptor.styles.length) {
        descriptor.styles
            .filter((style) => style.src || nonWhitespaceRE.test(style.content))
            .forEach((style, i) => {
            const src = style.src || resourcePath;
            const attrsQuery = attrsToQuery(style.attrs, 'css');
            const lang = String(style.attrs.lang || 'css');
            // make sure to only pass id when necessary so that we don't inject
            // duplicate tags when multiple components import the same css file
            const idQuery = !style.src || style.scoped ? `&id=${id}` : ``;
            const inlineQuery = asCustomElement ? `&inline` : ``;
            const externalQuery = Boolean(style.src) ? `&external` : ``;
            const query = `?vue&type=style&index=${i}${idQuery}${inlineQuery}${attrsQuery}${resourceQuery}${externalQuery}`;
            let styleRequest;
            if (enableInlineMatchResource) {
                styleRequest = stringifyRequest((0, util_1.genMatchResource)(this, src, query, lang));
            }
            else {
                styleRequest = stringifyRequest(src + query);
            }
            if (style.module) {
                if (asCustomElement) {
                    loaderContext.emitError(new Error(`<style module> is not supported in custom element mode.`));
                }
                if (!hasCSSModules) {
                    stylesCode += `\nconst cssModules = {}`;
                    propsToAttach.push([`__cssModules`, `cssModules`]);
                    hasCSSModules = true;
                }
                stylesCode += (0, cssModules_1.genCSSModulesCode)(id, i, styleRequest, style.module, needsHotReload);
            }
            else {
                if (asCustomElement) {
                    stylesCode += `\nimport _style_${i} from ${styleRequest}`;
                }
                else {
                    stylesCode += `\nimport ${styleRequest}`;
                }
            }
            // TODO SSR critical CSS collection
        });
        if (asCustomElement) {
            propsToAttach.push([
                `styles`,
                `[${descriptor.styles.map((_, i) => `_style_${i}`)}]`,
            ]);
        }
    }
    let code = [templateImport, scriptImport, stylesCode]
        .filter(Boolean)
        .join('\n');
    // attach scope Id for runtime use
    if (hasScoped) {
        propsToAttach.push([`__scopeId`, `"data-v-${id}"`]);
    }
    // Expose filename. This is used by the devtools and Vue runtime warnings.
    if (!isProduction) {
        // Expose the file's full path in development, so that it can be opened
        // from the devtools.
        propsToAttach.push([
            `__file`,
            JSON.stringify(rawShortFilePath.replace(/\\/g, '/')),
        ]);
    }
    else if (options.exposeFilename) {
        // Libraries can opt-in to expose their components' filenames in production builds.
        // For security reasons, only expose the file's basename in production.
        propsToAttach.push([`__file`, JSON.stringify(path.basename(resourcePath))]);
    }
    // custom blocks
    if (descriptor.customBlocks && descriptor.customBlocks.length) {
        code += `\n/* custom blocks */\n`;
        code +=
            descriptor.customBlocks
                .map((block, i) => {
                const src = block.attrs.src || resourcePath;
                const attrsQuery = attrsToQuery(block.attrs);
                const blockTypeQuery = `&blockType=${qs.escape(block.type)}`;
                const issuerQuery = block.attrs.src
                    ? `&issuerPath=${qs.escape(resourcePath)}`
                    : '';
                const externalQuery = Boolean(block.attrs.src) ? `&external` : ``;
                const query = `?vue&type=custom&index=${i}${blockTypeQuery}${issuerQuery}${attrsQuery}${resourceQuery}${externalQuery}`;
                let customRequest;
                if (enableInlineMatchResource) {
                    customRequest = stringifyRequest((0, util_1.genMatchResource)(this, src, query, block.attrs.lang));
                }
                else {
                    customRequest = stringifyRequest(src + query);
                }
                return (`import block${i} from ${customRequest}\n` +
                    `if (typeof block${i} === 'function') block${i}(script)`);
            })
                .join(`\n`) + `\n`;
    }
    // finalize
    if (!propsToAttach.length) {
        code += `\n\nconst __exports__ = script;`;
    }
    else {
        code += `\n\nimport exportComponent from ${stringifyRequest(exportHelperPath)}`;
        code += `\nconst __exports__ = /*#__PURE__*/exportComponent(script, [${propsToAttach
            .map(([key, val]) => `['${key}',${val}]`)
            .join(',')}])`;
    }
    if (needsHotReload) {
        code += (0, hotReload_1.genHotReloadCode)(id, templateRequest);
    }
    code += `\n\nexport default __exports__`;
    return code;
}
exports.default = loader;
// these are built-in query parameters so should be ignored
// if the user happen to add them as attrs
const ignoreList = ['id', 'index', 'src', 'type'];
function attrsToQuery(attrs, langFallback) {
    let query = ``;
    for (const name in attrs) {
        const value = attrs[name];
        if (!ignoreList.includes(name)) {
            query += `&${qs.escape(name)}=${value ? qs.escape(String(value)) : ``}`;
        }
    }
    if (langFallback && !(`lang` in attrs)) {
        query += `&lang=${langFallback}`;
    }
    return query;
}
