"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _postcssValueParser = _interopRequireDefault(require("postcss-value-parser"));
var _utils = require("../utils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const isUrlFunc = /url/i;
const isImageSetFunc = /^(?:-webkit-)?image-set$/i;
const needParseDeclaration = /(?:url|(?:-webkit-)?image-set)\(/i;
function getNodeFromUrlFunc(node) {
  return node.nodes && node.nodes[0];
}
function getWebpackIgnoreCommentValue(index, nodes, inBetween) {
  if (index === 0 && typeof inBetween !== "undefined") {
    return inBetween;
  }
  let prevValueNode = nodes[index - 1];
  if (!prevValueNode) {
    // eslint-disable-next-line consistent-return
    return;
  }
  if (prevValueNode.type === "space") {
    if (!nodes[index - 2]) {
      // eslint-disable-next-line consistent-return
      return;
    }
    prevValueNode = nodes[index - 2];
  }
  if (prevValueNode.type !== "comment") {
    // eslint-disable-next-line consistent-return
    return;
  }
  const matched = prevValueNode.value.match(_utils.WEBPACK_IGNORE_COMMENT_REGEXP);
  return matched && matched[2] === "true";
}
function shouldHandleURL(url, declaration, result, options) {
  if (url.length === 0) {
    result.warn(`Unable to find uri in '${declaration.toString()}'`, {
      node: declaration
    });
    return {
      requestable: false,
      needResolve: false
    };
  }
  return (0, _utils.isURLRequestable)(url, options);
}
function parseDeclaration(declaration, key, result, options) {
  if (!needParseDeclaration.test(declaration[key])) {
    return;
  }
  const parsed = (0, _postcssValueParser.default)(declaration.raws && declaration.raws.value && declaration.raws.value.raw ? declaration.raws.value.raw : declaration[key]);
  let inBetween;
  if (declaration.raws && declaration.raws.between) {
    const lastCommentIndex = declaration.raws.between.lastIndexOf("/*");
    const matched = declaration.raws.between.slice(lastCommentIndex).match(_utils.WEBPACK_IGNORE_COMMENT_REGEXP);
    if (matched) {
      inBetween = matched[2] === "true";
    }
  }
  let isIgnoreOnDeclaration = false;
  const prevNode = declaration.prev();
  if (prevNode && prevNode.type === "comment") {
    const matched = prevNode.text.match(_utils.WEBPACK_IGNORE_COMMENT_REGEXP);
    if (matched) {
      isIgnoreOnDeclaration = matched[2] === "true";
    }
  }
  let needIgnore;
  const parsedURLs = [];
  parsed.walk((valueNode, index, valueNodes) => {
    if (valueNode.type !== "function") {
      return;
    }
    if (isUrlFunc.test(valueNode.value)) {
      needIgnore = getWebpackIgnoreCommentValue(index, valueNodes, inBetween);
      if (isIgnoreOnDeclaration && typeof needIgnore === "undefined" || needIgnore) {
        if (needIgnore) {
          // eslint-disable-next-line no-undefined
          needIgnore = undefined;
        }
        return;
      }
      const {
        nodes
      } = valueNode;
      const isStringValue = nodes.length !== 0 && nodes[0].type === "string";
      let url = isStringValue ? nodes[0].value : _postcssValueParser.default.stringify(nodes);
      url = (0, _utils.normalizeUrl)(url, isStringValue);
      const {
        requestable,
        needResolve
      } = shouldHandleURL(url, declaration, result, options);

      // Do not traverse inside `url`
      if (!requestable) {
        // eslint-disable-next-line consistent-return
        return false;
      }
      const queryParts = url.split("!");
      let prefix;
      if (queryParts.length > 1) {
        url = queryParts.pop();
        prefix = queryParts.join("!");
      }
      parsedURLs.push({
        declaration,
        parsed,
        node: getNodeFromUrlFunc(valueNode),
        prefix,
        url,
        needQuotes: false,
        needResolve
      });

      // eslint-disable-next-line consistent-return
      return false;
    } else if (isImageSetFunc.test(valueNode.value)) {
      for (const [innerIndex, nNode] of valueNode.nodes.entries()) {
        const {
          type,
          value
        } = nNode;
        if (type === "function" && isUrlFunc.test(value)) {
          needIgnore = getWebpackIgnoreCommentValue(innerIndex, valueNode.nodes);
          if (isIgnoreOnDeclaration && typeof needIgnore === "undefined" || needIgnore) {
            if (needIgnore) {
              // eslint-disable-next-line no-undefined
              needIgnore = undefined;
            }

            // eslint-disable-next-line no-continue
            continue;
          }
          const {
            nodes
          } = nNode;
          const isStringValue = nodes.length !== 0 && nodes[0].type === "string";
          let url = isStringValue ? nodes[0].value : _postcssValueParser.default.stringify(nodes);
          url = (0, _utils.normalizeUrl)(url, isStringValue);
          const {
            requestable,
            needResolve
          } = shouldHandleURL(url, declaration, result, options);

          // Do not traverse inside `url`
          if (!requestable) {
            // eslint-disable-next-line consistent-return
            return false;
          }
          const queryParts = url.split("!");
          let prefix;
          if (queryParts.length > 1) {
            url = queryParts.pop();
            prefix = queryParts.join("!");
          }
          parsedURLs.push({
            declaration,
            parsed,
            node: getNodeFromUrlFunc(nNode),
            prefix,
            url,
            needQuotes: false,
            needResolve
          });
        } else if (type === "string") {
          needIgnore = getWebpackIgnoreCommentValue(innerIndex, valueNode.nodes);
          if (isIgnoreOnDeclaration && typeof needIgnore === "undefined" || needIgnore) {
            if (needIgnore) {
              // eslint-disable-next-line no-undefined
              needIgnore = undefined;
            }

            // eslint-disable-next-line no-continue
            continue;
          }
          let url = (0, _utils.normalizeUrl)(value, true);
          const {
            requestable,
            needResolve
          } = shouldHandleURL(url, declaration, result, options);

          // Do not traverse inside `url`
          if (!requestable) {
            // eslint-disable-next-line consistent-return
            return false;
          }
          const queryParts = url.split("!");
          let prefix;
          if (queryParts.length > 1) {
            url = queryParts.pop();
            prefix = queryParts.join("!");
          }
          parsedURLs.push({
            declaration,
            parsed,
            node: nNode,
            prefix,
            url,
            needQuotes: true,
            needResolve
          });
        }
      }

      // Do not traverse inside `image-set`
      // eslint-disable-next-line consistent-return
      return false;
    }
  });

  // eslint-disable-next-line consistent-return
  return parsedURLs;
}
const plugin = (options = {}) => {
  return {
    postcssPlugin: "postcss-url-parser",
    prepare(result) {
      const parsedDeclarations = [];
      return {
        Declaration(declaration) {
          const {
            isSupportDataURL,
            isSupportAbsoluteURL
          } = options;
          const parsedURL = parseDeclaration(declaration, "value", result, {
            isSupportDataURL,
            isSupportAbsoluteURL
          });
          if (!parsedURL) {
            return;
          }
          parsedDeclarations.push(...parsedURL);
        },
        async OnceExit() {
          if (parsedDeclarations.length === 0) {
            return;
          }
          const resolvedDeclarations = await Promise.all(parsedDeclarations.map(async parsedDeclaration => {
            const {
              url,
              needResolve
            } = parsedDeclaration;
            if (options.filter) {
              const needKeep = await options.filter(url);
              if (!needKeep) {
                // eslint-disable-next-line consistent-return
                return;
              }
            }
            if (!needResolve) {
              // eslint-disable-next-line consistent-return
              return parsedDeclaration;
            }
            const splittedUrl = url.split(/(\?)?#/);
            const [pathname, query, hashOrQuery] = splittedUrl;
            let hash = query ? "?" : "";
            hash += hashOrQuery ? `#${hashOrQuery}` : "";
            const {
              resolver,
              rootContext
            } = options;
            const request = (0, _utils.requestify)(pathname, rootContext, Boolean(resolver));
            if (!resolver) {
              // eslint-disable-next-line consistent-return
              return {
                ...parsedDeclaration,
                url: request,
                hash
              };
            }
            const resolvedURL = await (0, _utils.resolveRequests)(resolver, options.context, [...new Set([request, url])]);
            if (!resolvedURL) {
              // eslint-disable-next-line consistent-return
              return;
            }

            // eslint-disable-next-line consistent-return
            return {
              ...parsedDeclaration,
              url: resolvedURL,
              hash
            };
          }));
          const urlToNameMap = new Map();
          const urlToReplacementMap = new Map();
          let hasUrlImportHelper = false;
          for (let index = 0; index <= resolvedDeclarations.length - 1; index++) {
            const item = resolvedDeclarations[index];
            if (!item) {
              // eslint-disable-next-line no-continue
              continue;
            }
            if (!hasUrlImportHelper) {
              options.imports.push({
                type: "get_url_import",
                importName: "___CSS_LOADER_GET_URL_IMPORT___",
                url: options.urlHandler(require.resolve("../runtime/getUrl.js")),
                index: -1
              });
              hasUrlImportHelper = true;
            }
            const {
              url,
              prefix
            } = item;
            const newUrl = prefix ? `${prefix}!${url}` : url;
            let importName = urlToNameMap.get(newUrl);
            if (!importName) {
              importName = `___CSS_LOADER_URL_IMPORT_${urlToNameMap.size}___`;
              urlToNameMap.set(newUrl, importName);
              options.imports.push({
                type: "url",
                importName,
                url: options.resolver ? options.urlHandler(newUrl) : JSON.stringify(newUrl),
                index
              });
            }
            const {
              hash,
              needQuotes
            } = item;
            const replacementKey = JSON.stringify({
              newUrl,
              hash,
              needQuotes
            });
            let replacementName = urlToReplacementMap.get(replacementKey);
            if (!replacementName) {
              replacementName = `___CSS_LOADER_URL_REPLACEMENT_${urlToReplacementMap.size}___`;
              urlToReplacementMap.set(replacementKey, replacementName);
              options.replacements.push({
                replacementName,
                importName,
                hash,
                needQuotes
              });
            }

            // eslint-disable-next-line no-param-reassign
            item.node.type = "word";
            // eslint-disable-next-line no-param-reassign
            item.node.value = replacementName;
            // eslint-disable-next-line no-param-reassign
            item.declaration.value = item.parsed.toString();
          }
        }
      };
    }
  };
};
plugin.postcss = true;
var _default = plugin;
exports.default = _default;