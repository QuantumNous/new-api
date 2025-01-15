"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _postcssValueParser = _interopRequireDefault(require("postcss-value-parser"));
var _utils = require("../utils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function parseNode(atRule, key, options) {
  // Convert only top-level @import
  if (atRule.parent.type !== "root") {
    return;
  }
  if (atRule.raws && atRule.raws.afterName && atRule.raws.afterName.trim().length > 0) {
    const lastCommentIndex = atRule.raws.afterName.lastIndexOf("/*");
    const matched = atRule.raws.afterName.slice(lastCommentIndex).match(_utils.WEBPACK_IGNORE_COMMENT_REGEXP);
    if (matched && matched[2] === "true") {
      return;
    }
  }
  const prevNode = atRule.prev();
  if (prevNode && prevNode.type === "comment") {
    const matched = prevNode.text.match(_utils.WEBPACK_IGNORE_COMMENT_REGEXP);
    if (matched && matched[2] === "true") {
      return;
    }
  }

  // Nodes do not exists - `@import url('http://') :root {}`
  if (atRule.nodes) {
    const error = new Error("It looks like you didn't end your @import statement correctly. Child nodes are attached to it.");
    error.node = atRule;
    throw error;
  }
  const rawParams = atRule.raws && atRule.raws[key] && typeof atRule.raws[key].raw !== "undefined" ? atRule.raws[key].raw : atRule[key];
  const {
    nodes: paramsNodes
  } = (0, _postcssValueParser.default)(rawParams);

  // No nodes - `@import ;`
  // Invalid type - `@import foo-bar;`
  if (paramsNodes.length === 0 || paramsNodes[0].type !== "string" && paramsNodes[0].type !== "function") {
    const error = new Error(`Unable to find uri in "${atRule.toString()}"`);
    error.node = atRule;
    throw error;
  }
  let isStringValue;
  let url;
  if (paramsNodes[0].type === "string") {
    isStringValue = true;
    url = paramsNodes[0].value;
  } else {
    // Invalid function - `@import nourl(test.css);`
    if (paramsNodes[0].value.toLowerCase() !== "url") {
      const error = new Error(`Unable to find uri in "${atRule.toString()}"`);
      error.node = atRule;
      throw error;
    }
    isStringValue = paramsNodes[0].nodes.length !== 0 && paramsNodes[0].nodes[0].type === "string";
    url = isStringValue ? paramsNodes[0].nodes[0].value : _postcssValueParser.default.stringify(paramsNodes[0].nodes);
  }
  url = (0, _utils.normalizeUrl)(url, isStringValue);
  const {
    requestable,
    needResolve
  } = (0, _utils.isURLRequestable)(url, options);
  let prefix;
  if (requestable && needResolve) {
    const queryParts = url.split("!");
    if (queryParts.length > 1) {
      url = queryParts.pop();
      prefix = queryParts.join("!");
    }
  }

  // Empty url - `@import "";` or `@import url();`
  if (url.trim().length === 0) {
    const error = new Error(`Unable to find uri in "${atRule.toString()}"`);
    error.node = atRule;
    throw error;
  }
  const additionalNodes = paramsNodes.slice(1);
  let supports;
  let layer;
  let media;
  if (additionalNodes.length > 0) {
    let nodes = [];
    for (const node of additionalNodes) {
      nodes.push(node);
      const isLayerFunction = node.type === "function" && node.value.toLowerCase() === "layer";
      const isLayerWord = node.type === "word" && node.value.toLowerCase() === "layer";
      if (isLayerFunction || isLayerWord) {
        if (isLayerFunction) {
          nodes.splice(nodes.length - 1, 1, ...node.nodes);
        } else {
          nodes.splice(nodes.length - 1, 1, {
            type: "string",
            value: "",
            unclosed: false
          });
        }
        layer = _postcssValueParser.default.stringify(nodes).trim().toLowerCase();
        nodes = [];
      } else if (node.type === "function" && node.value.toLowerCase() === "supports") {
        nodes.splice(nodes.length - 1, 1, ...node.nodes);
        supports = _postcssValueParser.default.stringify(nodes).trim().toLowerCase();
        nodes = [];
      }
    }
    if (nodes.length > 0) {
      media = _postcssValueParser.default.stringify(nodes).trim().toLowerCase();
    }
  }

  // eslint-disable-next-line consistent-return
  return {
    atRule,
    prefix,
    url,
    layer,
    supports,
    media,
    requestable,
    needResolve
  };
}
const plugin = (options = {}) => {
  return {
    postcssPlugin: "postcss-import-parser",
    prepare(result) {
      const parsedAtRules = [];
      return {
        AtRule: {
          import(atRule) {
            if (options.isCSSStyleSheet) {
              options.loaderContext.emitError(new Error(atRule.error("'@import' rules are not allowed here and will not be processed").message));
              return;
            }
            const {
              isSupportDataURL,
              isSupportAbsoluteURL
            } = options;
            let parsedAtRule;
            try {
              parsedAtRule = parseNode(atRule, "params", {
                isSupportAbsoluteURL,
                isSupportDataURL
              });
            } catch (error) {
              result.warn(error.message, {
                node: error.node
              });
            }
            if (!parsedAtRule) {
              return;
            }
            parsedAtRules.push(parsedAtRule);
          }
        },
        async OnceExit() {
          if (parsedAtRules.length === 0) {
            return;
          }
          const {
            loaderContext
          } = options;
          const resolver = loaderContext.getResolve({
            dependencyType: "css",
            conditionNames: ["style"],
            mainFields: ["css", "style", "main", "..."],
            mainFiles: ["index", "..."],
            extensions: [".css", "..."],
            preferRelative: true
          });
          const resolvedAtRules = await Promise.all(parsedAtRules.map(async parsedAtRule => {
            const {
              atRule,
              requestable,
              needResolve,
              prefix,
              url,
              layer,
              supports,
              media
            } = parsedAtRule;
            if (options.filter) {
              const needKeep = await options.filter(url, media, loaderContext.resourcePath, supports, layer);
              if (!needKeep) {
                return;
              }
            }
            if (needResolve) {
              const request = (0, _utils.requestify)(url, loaderContext.rootContext);
              const resolvedUrl = await (0, _utils.resolveRequests)(resolver, loaderContext.context, [...new Set([request, url])]);
              if (!resolvedUrl) {
                return;
              }
              if (resolvedUrl === loaderContext.resourcePath) {
                atRule.remove();
                return;
              }
              atRule.remove();

              // eslint-disable-next-line consistent-return
              return {
                url: resolvedUrl,
                layer,
                supports,
                media,
                prefix,
                requestable
              };
            }
            atRule.remove();

            // eslint-disable-next-line consistent-return
            return {
              url,
              layer,
              supports,
              media,
              prefix,
              requestable
            };
          }));
          const urlToNameMap = new Map();
          for (let index = 0; index <= resolvedAtRules.length - 1; index++) {
            const resolvedAtRule = resolvedAtRules[index];
            if (!resolvedAtRule) {
              // eslint-disable-next-line no-continue
              continue;
            }
            const {
              url,
              requestable,
              layer,
              supports,
              media
            } = resolvedAtRule;
            if (!requestable) {
              options.api.push({
                url,
                layer,
                supports,
                media,
                index
              });

              // eslint-disable-next-line no-continue
              continue;
            }
            const {
              prefix
            } = resolvedAtRule;
            const newUrl = prefix ? `${prefix}!${url}` : url;
            let importName = urlToNameMap.get(newUrl);
            if (!importName) {
              importName = `___CSS_LOADER_AT_RULE_IMPORT_${urlToNameMap.size}___`;
              urlToNameMap.set(newUrl, importName);
              options.imports.push({
                type: "rule_import",
                importName,
                url: options.urlHandler(newUrl),
                index
              });
            }
            options.api.push({
              importName,
              layer,
              supports,
              media,
              index
            });
          }
        }
      };
    }
  };
};
plugin.postcss = true;
var _default = plugin;
exports.default = _default;