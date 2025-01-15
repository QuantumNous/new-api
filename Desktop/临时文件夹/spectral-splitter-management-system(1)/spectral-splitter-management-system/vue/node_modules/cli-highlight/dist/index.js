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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportsLanguage = exports.listLanguages = exports.highlight = void 0;
var hljs = __importStar(require("highlight.js"));
var parse5 = __importStar(require("parse5"));
var parse5_htmlparser2_tree_adapter_1 = __importDefault(require("parse5-htmlparser2-tree-adapter"));
var theme_1 = require("./theme");
function colorizeNode(node, theme, context) {
    if (theme === void 0) { theme = {}; }
    switch (node.type) {
        case 'text': {
            var text = node.data;
            if (context === undefined) {
                return (theme.default || theme_1.DEFAULT_THEME.default || theme_1.plain)(text);
            }
            return text;
        }
        case 'tag': {
            var hljsClass = /hljs-(\w+)/.exec(node.attribs.class);
            if (hljsClass) {
                var token_1 = hljsClass[1];
                var nodeData = node.childNodes
                    .map(function (node) { return colorizeNode(node, theme, token_1); })
                    .join('');
                return (theme[token_1] || theme_1.DEFAULT_THEME[token_1] || theme_1.plain)(nodeData);
            }
            // Return the data itself when the class name isn't prefixed with a highlight.js token prefix.
            // This is common in instances of sublanguages (JSX, Markdown Code Blocks, etc.)
            return node.childNodes.map(function (node) { return colorizeNode(node, theme); }).join('');
        }
    }
    throw new Error('Invalid node type ' + node.type);
}
function colorize(code, theme) {
    if (theme === void 0) { theme = {}; }
    var fragment = parse5.parseFragment(code, {
        treeAdapter: parse5_htmlparser2_tree_adapter_1.default,
    });
    return fragment.childNodes.map(function (node) { return colorizeNode(node, theme); }).join('');
}
/**
 * Apply syntax highlighting to `code` with ASCII color codes. The language is automatically
 * detected if not set.
 *
 * ```ts
 * import {highlight} from 'cli-highlight';
 * import * as fs from 'fs';
 *
 * fs.readFile('package.json', 'utf8', (err: any, json: string) => {
 *     console.log('package.json:');
 *     console.log(highlight(json));
 * });
 * ```
 *
 * @param code The code to highlight
 * @param options Optional options
 */
function highlight(code, options) {
    if (options === void 0) { options = {}; }
    var html;
    if (options.language) {
        html = hljs.highlight(code, { language: options.language, ignoreIllegals: options.ignoreIllegals }).value;
    }
    else {
        html = hljs.highlightAuto(code, options.languageSubset).value;
    }
    return colorize(html, options.theme);
}
exports.highlight = highlight;
/**
 * Returns all supported languages
 */
function listLanguages() {
    return hljs.listLanguages();
}
exports.listLanguages = listLanguages;
/**
 * Returns true if the language is supported
 * @param name A language name, alias or file extension
 */
function supportsLanguage(name) {
    return !!hljs.getLanguage(name);
}
exports.supportsLanguage = supportsLanguage;
exports.default = highlight;
__exportStar(require("./theme"), exports);
//# sourceMappingURL=index.js.map