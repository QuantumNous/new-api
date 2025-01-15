"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WEBPACK_IGNORE_COMMENT_REGEXP = void 0;
exports.camelCase = camelCase;
exports.combineRequests = combineRequests;
exports.defaultGetLocalIdent = defaultGetLocalIdent;
exports.getExportCode = getExportCode;
exports.getFilter = getFilter;
exports.getImportCode = getImportCode;
exports.getModuleCode = getModuleCode;
exports.getModulesOptions = getModulesOptions;
exports.getModulesPlugins = getModulesPlugins;
exports.getPreRequester = getPreRequester;
exports.isDataUrl = isDataUrl;
exports.isURLRequestable = isURLRequestable;
exports.normalizeOptions = normalizeOptions;
exports.normalizeSourceMap = normalizeSourceMap;
exports.normalizeUrl = normalizeUrl;
exports.requestify = requestify;
exports.resolveRequests = resolveRequests;
exports.shouldUseIcssPlugin = shouldUseIcssPlugin;
exports.shouldUseImportPlugin = shouldUseImportPlugin;
exports.shouldUseModulesPlugins = shouldUseModulesPlugins;
exports.shouldUseURLPlugin = shouldUseURLPlugin;
exports.sort = sort;
exports.stringifyRequest = stringifyRequest;
exports.syntaxErrorFactory = syntaxErrorFactory;
exports.warningFactory = warningFactory;
var _url = require("url");
var _path = _interopRequireDefault(require("path"));
var _postcssModulesValues = _interopRequireDefault(require("postcss-modules-values"));
var _postcssModulesLocalByDefault = _interopRequireDefault(require("postcss-modules-local-by-default"));
var _postcssModulesExtractImports = _interopRequireDefault(require("postcss-modules-extract-imports"));
var _postcssModulesScope = _interopRequireDefault(require("postcss-modules-scope"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/

const WEBPACK_IGNORE_COMMENT_REGEXP = /webpackIgnore:(\s+)?(true|false)/;
exports.WEBPACK_IGNORE_COMMENT_REGEXP = WEBPACK_IGNORE_COMMENT_REGEXP;
const matchRelativePath = /^\.\.?[/\\]/;
function isAbsolutePath(str) {
  return _path.default.posix.isAbsolute(str) || _path.default.win32.isAbsolute(str);
}
function isRelativePath(str) {
  return matchRelativePath.test(str);
}

// TODO simplify for the next major release
function stringifyRequest(loaderContext, request) {
  if (typeof loaderContext.utils !== "undefined" && typeof loaderContext.utils.contextify === "function") {
    return JSON.stringify(loaderContext.utils.contextify(loaderContext.context || loaderContext.rootContext, request));
  }
  const splitted = request.split("!");
  const {
    context
  } = loaderContext;
  return JSON.stringify(splitted.map(part => {
    // First, separate singlePath from query, because the query might contain paths again
    const splittedPart = part.match(/^(.*?)(\?.*)/);
    const query = splittedPart ? splittedPart[2] : "";
    let singlePath = splittedPart ? splittedPart[1] : part;
    if (isAbsolutePath(singlePath) && context) {
      singlePath = _path.default.relative(context, singlePath);
      if (isAbsolutePath(singlePath)) {
        // If singlePath still matches an absolute path, singlePath was on a different drive than context.
        // In this case, we leave the path platform-specific without replacing any separators.
        // @see https://github.com/webpack/loader-utils/pull/14
        return singlePath + query;
      }
      if (isRelativePath(singlePath) === false) {
        // Ensure that the relative path starts at least with ./ otherwise it would be a request into the modules directory (like node_modules).
        singlePath = `./${singlePath}`;
      }
    }
    return singlePath.replace(/\\/g, "/") + query;
  }).join("!"));
}

// We can't use path.win32.isAbsolute because it also matches paths starting with a forward slash
const IS_NATIVE_WIN32_PATH = /^[a-z]:[/\\]|^\\\\/i;
const IS_MODULE_REQUEST = /^[^?]*~/;
function urlToRequest(url, root) {
  let request;
  if (IS_NATIVE_WIN32_PATH.test(url)) {
    // absolute windows path, keep it
    request = url;
  } else if (typeof root !== "undefined" && /^\//.test(url)) {
    request = root + url;
  } else if (/^\.\.?\//.test(url)) {
    // A relative url stays
    request = url;
  } else {
    // every other url is threaded like a relative url
    request = `./${url}`;
  }

  // A `~` makes the url an module
  if (IS_MODULE_REQUEST.test(request)) {
    request = request.replace(IS_MODULE_REQUEST, "");
  }
  return request;
}

// eslint-disable-next-line no-useless-escape
const regexSingleEscape = /[ -,.\/:-@[\]\^`{-~]/;
const regexExcessiveSpaces = /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g;
const preserveCamelCase = string => {
  let result = string;
  let isLastCharLower = false;
  let isLastCharUpper = false;
  let isLastLastCharUpper = false;
  for (let i = 0; i < result.length; i++) {
    const character = result[i];
    if (isLastCharLower && /[\p{Lu}]/u.test(character)) {
      result = `${result.slice(0, i)}-${result.slice(i)}`;
      isLastCharLower = false;
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = true;
      i += 1;
    } else if (isLastCharUpper && isLastLastCharUpper && /[\p{Ll}]/u.test(character)) {
      result = `${result.slice(0, i - 1)}-${result.slice(i - 1)}`;
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = false;
      isLastCharLower = true;
    } else {
      isLastCharLower = character.toLowerCase() === character && character.toUpperCase() !== character;
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = character.toUpperCase() === character && character.toLowerCase() !== character;
    }
  }
  return result;
};
function camelCase(input) {
  let result = input.trim();
  if (result.length === 0) {
    return "";
  }
  if (result.length === 1) {
    return result.toLowerCase();
  }
  const hasUpperCase = result !== result.toLowerCase();
  if (hasUpperCase) {
    result = preserveCamelCase(result);
  }
  return result.replace(/^[_.\- ]+/, "").toLowerCase().replace(/[_.\- ]+([\p{Alpha}\p{N}_]|$)/gu, (_, p1) => p1.toUpperCase()).replace(/\d+([\p{Alpha}\p{N}_]|$)/gu, m => m.toUpperCase());
}
function escape(string) {
  let output = "";
  let counter = 0;
  while (counter < string.length) {
    // eslint-disable-next-line no-plusplus
    const character = string.charAt(counter++);
    let value;

    // eslint-disable-next-line no-control-regex
    if (/[\t\n\f\r\x0B]/.test(character)) {
      const codePoint = character.charCodeAt();
      value = `\\${codePoint.toString(16).toUpperCase()} `;
    } else if (character === "\\" || regexSingleEscape.test(character)) {
      value = `\\${character}`;
    } else {
      value = character;
    }
    output += value;
  }
  const firstChar = string.charAt(0);
  if (/^-[-\d]/.test(output)) {
    output = `\\-${output.slice(1)}`;
  } else if (/\d/.test(firstChar)) {
    output = `\\3${firstChar} ${output.slice(1)}`;
  }

  // Remove spaces after `\HEX` escapes that are not followed by a hex digit,
  // since they’re redundant. Note that this is only possible if the escape
  // sequence isn’t preceded by an odd number of backslashes.
  output = output.replace(regexExcessiveSpaces, ($0, $1, $2) => {
    if ($1 && $1.length % 2) {
      // It’s not safe to remove the space, so don’t.
      return $0;
    }

    // Strip the space.
    return ($1 || "") + $2;
  });
  return output;
}
function gobbleHex(str) {
  const lower = str.toLowerCase();
  let hex = "";
  let spaceTerminated = false;

  // eslint-disable-next-line no-undefined
  for (let i = 0; i < 6 && lower[i] !== undefined; i++) {
    const code = lower.charCodeAt(i);
    // check to see if we are dealing with a valid hex char [a-f|0-9]
    const valid = code >= 97 && code <= 102 || code >= 48 && code <= 57;
    // https://drafts.csswg.org/css-syntax/#consume-escaped-code-point
    spaceTerminated = code === 32;
    if (!valid) {
      break;
    }
    hex += lower[i];
  }
  if (hex.length === 0) {
    // eslint-disable-next-line no-undefined
    return undefined;
  }
  const codePoint = parseInt(hex, 16);
  const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff;
  // Add special case for
  // "If this number is zero, or is for a surrogate, or is greater than the maximum allowed code point"
  // https://drafts.csswg.org/css-syntax/#maximum-allowed-code-point
  if (isSurrogate || codePoint === 0x0000 || codePoint > 0x10ffff) {
    return ["\uFFFD", hex.length + (spaceTerminated ? 1 : 0)];
  }
  return [String.fromCodePoint(codePoint), hex.length + (spaceTerminated ? 1 : 0)];
}
const CONTAINS_ESCAPE = /\\/;
function unescape(str) {
  const needToProcess = CONTAINS_ESCAPE.test(str);
  if (!needToProcess) {
    return str;
  }
  let ret = "";
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      const gobbled = gobbleHex(str.slice(i + 1, i + 7));

      // eslint-disable-next-line no-undefined
      if (gobbled !== undefined) {
        ret += gobbled[0];
        i += gobbled[1];

        // eslint-disable-next-line no-continue
        continue;
      }

      // Retain a pair of \\ if double escaped `\\\\`
      // https://github.com/postcss/postcss-selector-parser/commit/268c9a7656fb53f543dc620aa5b73a30ec3ff20e
      if (str[i + 1] === "\\") {
        ret += "\\";
        i += 1;

        // eslint-disable-next-line no-continue
        continue;
      }

      // if \\ is at the end of the string retain it
      // https://github.com/postcss/postcss-selector-parser/commit/01a6b346e3612ce1ab20219acc26abdc259ccefb
      if (str.length === i + 1) {
        ret += str[i];
      }

      // eslint-disable-next-line no-continue
      continue;
    }
    ret += str[i];
  }
  return ret;
}
function normalizePath(file) {
  return _path.default.sep === "\\" ? file.replace(/\\/g, "/") : file;
}

// eslint-disable-next-line no-control-regex
const filenameReservedRegex = /[<>:"/\\|?*]/g;
// eslint-disable-next-line no-control-regex
const reControlChars = /[\u0000-\u001f\u0080-\u009f]/g;
function escapeLocalIdent(localident) {
  // TODO simplify in the next major release
  return escape(localident
  // For `[hash]` placeholder
  .replace(/^((-?[0-9])|--)/, "_$1").replace(filenameReservedRegex, "-").replace(reControlChars, "-").replace(/\./g, "-"));
}
function defaultGetLocalIdent(loaderContext, localIdentName, localName, options) {
  const {
    context,
    hashSalt,
    hashStrategy
  } = options;
  const {
    resourcePath
  } = loaderContext;
  let relativeResourcePath = normalizePath(_path.default.relative(context, resourcePath));

  // eslint-disable-next-line no-underscore-dangle
  if (loaderContext._module && loaderContext._module.matchResource) {
    relativeResourcePath = `${normalizePath(
    // eslint-disable-next-line no-underscore-dangle
    _path.default.relative(context, loaderContext._module.matchResource))}`;
  }

  // eslint-disable-next-line no-param-reassign
  options.content = hashStrategy === "minimal-subset" && /\[local\]/.test(localIdentName) ? relativeResourcePath : `${relativeResourcePath}\x00${localName}`;
  let {
    hashFunction,
    hashDigest,
    hashDigestLength
  } = options;
  const matches = localIdentName.match(/\[(?:([^:\]]+):)?(?:(hash|contenthash|fullhash))(?::([a-z]+\d*))?(?::(\d+))?\]/i);
  if (matches) {
    const hashName = matches[2] || hashFunction;
    hashFunction = matches[1] || hashFunction;
    hashDigest = matches[3] || hashDigest;
    hashDigestLength = matches[4] || hashDigestLength;

    // `hash` and `contenthash` are same in `loader-utils` context
    // let's keep `hash` for backward compatibility

    // eslint-disable-next-line no-param-reassign
    localIdentName = localIdentName.replace(/\[(?:([^:\]]+):)?(?:hash|contenthash|fullhash)(?::([a-z]+\d*))?(?::(\d+))?\]/gi, () => hashName === "fullhash" ? "[fullhash]" : "[contenthash]");
  }
  let localIdentHash = "";
  for (let tier = 0; localIdentHash.length < hashDigestLength; tier++) {
    // TODO remove this in the next major release
    const hash = loaderContext.utils && typeof loaderContext.utils.createHash === "function" ? loaderContext.utils.createHash(hashFunction) :
    // eslint-disable-next-line no-underscore-dangle
    loaderContext._compiler.webpack.util.createHash(hashFunction);
    if (hashSalt) {
      hash.update(hashSalt);
    }
    const tierSalt = Buffer.allocUnsafe(4);
    tierSalt.writeUInt32LE(tier);
    hash.update(tierSalt);
    // TODO: bug in webpack with unicode characters with strings
    hash.update(Buffer.from(options.content, "utf8"));
    localIdentHash = (localIdentHash + hash.digest(hashDigest)
    // Remove all leading digits
    ).replace(/^\d+/, "")
    // Replace all slashes with underscores (same as in base64url)
    .replace(/\//g, "_")
    // Remove everything that is not an alphanumeric or underscore
    .replace(/[^A-Za-z0-9_]+/g, "").slice(0, hashDigestLength);
  }

  // TODO need improve on webpack side, we should allow to pass hash/contentHash without chunk property, also `data` for `getPath` should be looks good without chunk property
  const ext = _path.default.extname(resourcePath);
  const base = _path.default.basename(resourcePath);
  const name = base.slice(0, base.length - ext.length);
  const data = {
    filename: _path.default.relative(context, resourcePath),
    contentHash: localIdentHash,
    chunk: {
      name,
      hash: localIdentHash,
      contentHash: localIdentHash
    }
  };

  // eslint-disable-next-line no-underscore-dangle
  let result = loaderContext._compilation.getPath(localIdentName, data);
  if (/\[folder\]/gi.test(result)) {
    const dirname = _path.default.dirname(resourcePath);
    let directory = normalizePath(_path.default.relative(context, `${dirname + _path.default.sep}_`));
    directory = directory.substring(0, directory.length - 1);
    let folder = "";
    if (directory.length > 1) {
      folder = _path.default.basename(directory);
    }
    result = result.replace(/\[folder\]/gi, () => folder);
  }
  if (options.regExp) {
    const match = resourcePath.match(options.regExp);
    if (match) {
      match.forEach((matched, i) => {
        result = result.replace(new RegExp(`\\[${i}\\]`, "ig"), matched);
      });
    }
  }
  return result;
}
function fixedEncodeURIComponent(str) {
  return str.replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
}
function isDataUrl(url) {
  if (/^data:/i.test(url)) {
    return true;
  }
  return false;
}
const NATIVE_WIN32_PATH = /^[A-Z]:[/\\]|^\\\\/i;
function normalizeUrl(url, isStringValue) {
  let normalizedUrl = url.replace(/^( |\t\n|\r\n|\r|\f)*/g, "").replace(/( |\t\n|\r\n|\r|\f)*$/g, "");
  if (isStringValue && /\\(\n|\r\n|\r|\f)/.test(normalizedUrl)) {
    normalizedUrl = normalizedUrl.replace(/\\(\n|\r\n|\r|\f)/g, "");
  }
  if (NATIVE_WIN32_PATH.test(url)) {
    try {
      normalizedUrl = decodeURI(normalizedUrl);
    } catch (error) {
      // Ignore
    }
    return normalizedUrl;
  }
  normalizedUrl = unescape(normalizedUrl);
  if (isDataUrl(url)) {
    // Todo fixedEncodeURIComponent is workaround. Webpack resolver shouldn't handle "!" in dataURL
    return fixedEncodeURIComponent(normalizedUrl);
  }
  try {
    normalizedUrl = decodeURI(normalizedUrl);
  } catch (error) {
    // Ignore
  }
  return normalizedUrl;
}
function requestify(url, rootContext, needToResolveURL = true) {
  if (needToResolveURL) {
    if (/^file:/i.test(url)) {
      return (0, _url.fileURLToPath)(url);
    }
    return url.charAt(0) === "/" ? urlToRequest(url, rootContext) : urlToRequest(url);
  }
  if (url.charAt(0) === "/" || /^file:/i.test(url)) {
    return url;
  }

  // A `~` makes the url an module
  if (IS_MODULE_REQUEST.test(url)) {
    return url.replace(IS_MODULE_REQUEST, "");
  }
  return url;
}
function getFilter(filter, resourcePath) {
  return (...args) => {
    if (typeof filter === "function") {
      return filter(...args, resourcePath);
    }
    return true;
  };
}
function getValidLocalName(localName, exportLocalsConvention) {
  const result = exportLocalsConvention(localName);
  return Array.isArray(result) ? result[0] : result;
}
const IS_MODULES = /\.module(s)?\.\w+$/i;
const IS_ICSS = /\.icss\.\w+$/i;
function getModulesOptions(rawOptions, exportType, loaderContext) {
  if (typeof rawOptions.modules === "boolean" && rawOptions.modules === false) {
    return false;
  }
  const resourcePath =
  // eslint-disable-next-line no-underscore-dangle
  loaderContext._module && loaderContext._module.matchResource || loaderContext.resourcePath;
  let auto;
  let rawModulesOptions;
  if (typeof rawOptions.modules === "undefined") {
    rawModulesOptions = {};
    auto = true;
  } else if (typeof rawOptions.modules === "boolean") {
    rawModulesOptions = {};
  } else if (typeof rawOptions.modules === "string") {
    rawModulesOptions = {
      mode: rawOptions.modules
    };
  } else {
    rawModulesOptions = rawOptions.modules;
    ({
      auto
    } = rawModulesOptions);
  }

  // eslint-disable-next-line no-underscore-dangle
  const {
    outputOptions
  } = loaderContext._compilation;
  const needNamedExport = exportType === "css-style-sheet" || exportType === "string";
  const modulesOptions = {
    auto,
    mode: "local",
    exportGlobals: false,
    localIdentName: "[hash:base64]",
    localIdentContext: loaderContext.rootContext,
    localIdentHashSalt: outputOptions.hashSalt,
    localIdentHashFunction: outputOptions.hashFunction,
    localIdentHashDigest: outputOptions.hashDigest,
    localIdentHashDigestLength: outputOptions.hashDigestLength,
    // eslint-disable-next-line no-undefined
    localIdentRegExp: undefined,
    // eslint-disable-next-line no-undefined
    getLocalIdent: undefined,
    namedExport: needNamedExport || false,
    exportLocalsConvention: (rawModulesOptions.namedExport === true || needNamedExport) && typeof rawModulesOptions.exportLocalsConvention === "undefined" ? "camelCaseOnly" : "asIs",
    exportOnlyLocals: false,
    ...rawModulesOptions
  };
  let exportLocalsConventionType;
  if (typeof modulesOptions.exportLocalsConvention === "string") {
    exportLocalsConventionType = modulesOptions.exportLocalsConvention;
    modulesOptions.exportLocalsConvention = name => {
      switch (exportLocalsConventionType) {
        case "camelCase":
          {
            return [name, camelCase(name)];
          }
        case "camelCaseOnly":
          {
            return camelCase(name);
          }
        case "dashes":
          {
            return [name, dashesCamelCase(name)];
          }
        case "dashesOnly":
          {
            return dashesCamelCase(name);
          }
        case "asIs":
        default:
          return name;
      }
    };
  }
  if (typeof modulesOptions.auto === "boolean") {
    const isModules = modulesOptions.auto && IS_MODULES.test(resourcePath);
    let isIcss;
    if (!isModules) {
      isIcss = IS_ICSS.test(resourcePath);
      if (isIcss) {
        modulesOptions.mode = "icss";
      }
    }
    if (!isModules && !isIcss) {
      return false;
    }
  } else if (modulesOptions.auto instanceof RegExp) {
    const isModules = modulesOptions.auto.test(resourcePath);
    if (!isModules) {
      return false;
    }
  } else if (typeof modulesOptions.auto === "function") {
    const isModule = modulesOptions.auto(resourcePath);
    if (!isModule) {
      return false;
    }
  }
  if (typeof modulesOptions.mode === "function") {
    modulesOptions.mode = modulesOptions.mode(loaderContext.resourcePath);
  }
  if (needNamedExport) {
    if (rawOptions.esModule === false) {
      throw new Error("The 'exportType' option with the 'css-style-sheet' or 'string' value requires the 'esModules' option to be enabled");
    }
    if (modulesOptions.namedExport === false) {
      throw new Error("The 'exportType' option with the 'css-style-sheet' or 'string' value requires the 'modules.namedExport' option to be enabled");
    }
  }
  if (modulesOptions.namedExport === true) {
    if (rawOptions.esModule === false) {
      throw new Error("The 'modules.namedExport' option requires the 'esModules' option to be enabled");
    }
    if (typeof exportLocalsConventionType === "string" && exportLocalsConventionType !== "camelCaseOnly" && exportLocalsConventionType !== "dashesOnly") {
      throw new Error('The "modules.namedExport" option requires the "modules.exportLocalsConvention" option to be "camelCaseOnly" or "dashesOnly"');
    }
  }
  return modulesOptions;
}
function normalizeOptions(rawOptions, loaderContext) {
  const exportType = typeof rawOptions.exportType === "undefined" ? "array" : rawOptions.exportType;
  const modulesOptions = getModulesOptions(rawOptions, exportType, loaderContext);
  return {
    url: typeof rawOptions.url === "undefined" ? true : rawOptions.url,
    import: typeof rawOptions.import === "undefined" ? true : rawOptions.import,
    modules: modulesOptions,
    sourceMap: typeof rawOptions.sourceMap === "boolean" ? rawOptions.sourceMap : loaderContext.sourceMap,
    importLoaders: typeof rawOptions.importLoaders === "string" ? parseInt(rawOptions.importLoaders, 10) : rawOptions.importLoaders,
    esModule: typeof rawOptions.esModule === "undefined" ? true : rawOptions.esModule,
    exportType
  };
}
function shouldUseImportPlugin(options) {
  if (options.modules.exportOnlyLocals) {
    return false;
  }
  if (typeof options.import === "boolean") {
    return options.import;
  }
  return true;
}
function shouldUseURLPlugin(options) {
  if (options.modules.exportOnlyLocals) {
    return false;
  }
  if (typeof options.url === "boolean") {
    return options.url;
  }
  return true;
}
function shouldUseModulesPlugins(options) {
  if (typeof options.modules === "boolean" && options.modules === false) {
    return false;
  }
  return options.modules.mode !== "icss";
}
function shouldUseIcssPlugin(options) {
  return Boolean(options.modules);
}
function getModulesPlugins(options, loaderContext) {
  const {
    mode,
    getLocalIdent,
    localIdentName,
    localIdentContext,
    localIdentHashSalt,
    localIdentHashFunction,
    localIdentHashDigest,
    localIdentHashDigestLength,
    localIdentRegExp,
    hashStrategy
  } = options.modules;
  let plugins = [];
  try {
    plugins = [_postcssModulesValues.default, (0, _postcssModulesLocalByDefault.default)({
      mode
    }), (0, _postcssModulesExtractImports.default)(), (0, _postcssModulesScope.default)({
      generateScopedName(exportName) {
        let localIdent;
        if (typeof getLocalIdent !== "undefined") {
          localIdent = getLocalIdent(loaderContext, localIdentName, unescape(exportName), {
            context: localIdentContext,
            hashSalt: localIdentHashSalt,
            hashFunction: localIdentHashFunction,
            hashDigest: localIdentHashDigest,
            hashDigestLength: localIdentHashDigestLength,
            hashStrategy,
            regExp: localIdentRegExp
          });
        }

        // A null/undefined value signals that we should invoke the default
        // getLocalIdent method.
        if (typeof localIdent === "undefined" || localIdent === null) {
          localIdent = defaultGetLocalIdent(loaderContext, localIdentName, unescape(exportName), {
            context: localIdentContext,
            hashSalt: localIdentHashSalt,
            hashFunction: localIdentHashFunction,
            hashDigest: localIdentHashDigest,
            hashDigestLength: localIdentHashDigestLength,
            hashStrategy,
            regExp: localIdentRegExp
          });
          return escapeLocalIdent(localIdent).replace(/\\\[local\\]/gi, exportName);
        }
        return escapeLocalIdent(localIdent);
      },
      exportGlobals: options.modules.exportGlobals
    })];
  } catch (error) {
    loaderContext.emitError(error);
  }
  return plugins;
}
const ABSOLUTE_SCHEME = /^[a-z0-9+\-.]+:/i;
function getURLType(source) {
  if (source[0] === "/") {
    if (source[1] === "/") {
      return "scheme-relative";
    }
    return "path-absolute";
  }
  if (IS_NATIVE_WIN32_PATH.test(source)) {
    return "path-absolute";
  }
  return ABSOLUTE_SCHEME.test(source) ? "absolute" : "path-relative";
}
function normalizeSourceMap(map, resourcePath) {
  let newMap = map;

  // Some loader emit source map as string
  // Strip any JSON XSSI avoidance prefix from the string (as documented in the source maps specification), and then parse the string as JSON.
  if (typeof newMap === "string") {
    newMap = JSON.parse(newMap);
  }
  delete newMap.file;
  const {
    sourceRoot
  } = newMap;
  delete newMap.sourceRoot;
  if (newMap.sources) {
    // Source maps should use forward slash because it is URLs (https://github.com/mozilla/source-map/issues/91)
    // We should normalize path because previous loaders like `sass-loader` using backslash when generate source map
    newMap.sources = newMap.sources.map(source => {
      // Non-standard syntax from `postcss`
      if (source.indexOf("<") === 0) {
        return source;
      }
      const sourceType = getURLType(source);

      // Do no touch `scheme-relative` and `absolute` URLs
      if (sourceType === "path-relative" || sourceType === "path-absolute") {
        const absoluteSource = sourceType === "path-relative" && sourceRoot ? _path.default.resolve(sourceRoot, normalizePath(source)) : normalizePath(source);
        return _path.default.relative(_path.default.dirname(resourcePath), absoluteSource);
      }
      return source;
    });
  }
  return newMap;
}
function getPreRequester({
  loaders,
  loaderIndex
}) {
  const cache = Object.create(null);
  return number => {
    if (cache[number]) {
      return cache[number];
    }
    if (number === false) {
      cache[number] = "";
    } else {
      const loadersRequest = loaders.slice(loaderIndex, loaderIndex + 1 + (typeof number !== "number" ? 0 : number)).map(x => x.request).join("!");
      cache[number] = `-!${loadersRequest}!`;
    }
    return cache[number];
  };
}
function getImportCode(imports, options) {
  let code = "";
  for (const item of imports) {
    const {
      importName,
      url,
      icss,
      type
    } = item;
    if (options.esModule) {
      if (icss && options.modules.namedExport) {
        code += `import ${options.modules.exportOnlyLocals ? "" : `${importName}, `}* as ${importName}_NAMED___ from ${url};\n`;
      } else {
        code += type === "url" ? `var ${importName} = new URL(${url}, import.meta.url);\n` : `import ${importName} from ${url};\n`;
      }
    } else {
      code += `var ${importName} = require(${url});\n`;
    }
  }
  return code ? `// Imports\n${code}` : "";
}
function normalizeSourceMapForRuntime(map, loaderContext) {
  const resultMap = map ? map.toJSON() : null;
  if (resultMap) {
    delete resultMap.file;

    /* eslint-disable no-underscore-dangle */
    if (loaderContext._compilation && loaderContext._compilation.options && loaderContext._compilation.options.devtool && loaderContext._compilation.options.devtool.includes("nosources")) {
      /* eslint-enable no-underscore-dangle */

      delete resultMap.sourcesContent;
    }
    resultMap.sourceRoot = "";
    resultMap.sources = resultMap.sources.map(source => {
      // Non-standard syntax from `postcss`
      if (source.indexOf("<") === 0) {
        return source;
      }
      const sourceType = getURLType(source);
      if (sourceType !== "path-relative") {
        return source;
      }
      const resourceDirname = _path.default.dirname(loaderContext.resourcePath);
      const absoluteSource = _path.default.resolve(resourceDirname, source);
      const contextifyPath = normalizePath(_path.default.relative(loaderContext.rootContext, absoluteSource));
      return `webpack://./${contextifyPath}`;
    });
  }
  return JSON.stringify(resultMap);
}
function printParams(media, dedupe, supports, layer) {
  let result = "";
  if (typeof layer !== "undefined") {
    result = `, ${JSON.stringify(layer)}`;
  }
  if (typeof supports !== "undefined") {
    result = `, ${JSON.stringify(supports)}${result}`;
  } else if (result.length > 0) {
    result = `, undefined${result}`;
  }
  if (dedupe) {
    result = `, true${result}`;
  } else if (result.length > 0) {
    result = `, false${result}`;
  }
  if (media) {
    result = `${JSON.stringify(media)}${result}`;
  } else if (result.length > 0) {
    result = `""${result}`;
  }
  return result;
}
function getModuleCode(result, api, replacements, options, isTemplateLiteralSupported, loaderContext) {
  if (options.modules.exportOnlyLocals === true) {
    return "";
  }
  let sourceMapValue = "";
  if (options.sourceMap) {
    const sourceMap = result.map;
    sourceMapValue = `,${normalizeSourceMapForRuntime(sourceMap, loaderContext)}`;
  }
  let code = isTemplateLiteralSupported ? convertToTemplateLiteral(result.css) : JSON.stringify(result.css);
  let beforeCode = `var ___CSS_LOADER_EXPORT___ = ___CSS_LOADER_API_IMPORT___(${options.sourceMap ? "___CSS_LOADER_API_SOURCEMAP_IMPORT___" : "___CSS_LOADER_API_NO_SOURCEMAP_IMPORT___"});\n`;
  for (const item of api) {
    const {
      url,
      layer,
      supports,
      media,
      dedupe
    } = item;
    if (url) {
      // eslint-disable-next-line no-undefined
      const printedParam = printParams(media, undefined, supports, layer);
      beforeCode += `___CSS_LOADER_EXPORT___.push([module.id, ${JSON.stringify(`@import url(${url});`)}${printedParam.length > 0 ? `, ${printedParam}` : ""}]);\n`;
    } else {
      const printedParam = printParams(media, dedupe, supports, layer);
      beforeCode += `___CSS_LOADER_EXPORT___.i(${item.importName}${printedParam.length > 0 ? `, ${printedParam}` : ""});\n`;
    }
  }
  for (const item of replacements) {
    const {
      replacementName,
      importName,
      localName
    } = item;
    if (localName) {
      code = code.replace(new RegExp(replacementName, "g"), () => options.modules.namedExport ? isTemplateLiteralSupported ? `\${ ${importName}_NAMED___[${JSON.stringify(getValidLocalName(localName, options.modules.exportLocalsConvention))}] }` : `" + ${importName}_NAMED___[${JSON.stringify(getValidLocalName(localName, options.modules.exportLocalsConvention))}] + "` : isTemplateLiteralSupported ? `\${${importName}.locals[${JSON.stringify(localName)}]}` : `" + ${importName}.locals[${JSON.stringify(localName)}] + "`);
    } else {
      const {
        hash,
        needQuotes
      } = item;
      const getUrlOptions = [].concat(hash ? [`hash: ${JSON.stringify(hash)}`] : []).concat(needQuotes ? "needQuotes: true" : []);
      const preparedOptions = getUrlOptions.length > 0 ? `, { ${getUrlOptions.join(", ")} }` : "";
      beforeCode += `var ${replacementName} = ___CSS_LOADER_GET_URL_IMPORT___(${importName}${preparedOptions});\n`;
      code = code.replace(new RegExp(replacementName, "g"), () => isTemplateLiteralSupported ? `\${${replacementName}}` : `" + ${replacementName} + "`);
    }
  }

  // Indexes description:
  // 0 - module id
  // 1 - CSS code
  // 2 - media
  // 3 - source map
  // 4 - supports
  // 5 - layer
  return `${beforeCode}// Module\n___CSS_LOADER_EXPORT___.push([module.id, ${code}, ""${sourceMapValue}]);\n`;
}
const SLASH = "\\".charCodeAt(0);
const BACKTICK = "`".charCodeAt(0);
const DOLLAR = "$".charCodeAt(0);
function convertToTemplateLiteral(str) {
  let escapedString = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    escapedString += code === SLASH || code === BACKTICK || code === DOLLAR ? `\\${str[i]}` : str[i];
  }
  return `\`${escapedString}\``;
}
function dashesCamelCase(str) {
  return str.replace(/-+(\w)/g, (match, firstLetter) => firstLetter.toUpperCase());
}
function getExportCode(exports, replacements, icssPluginUsed, options, isTemplateLiteralSupported) {
  let code = "// Exports\n";
  if (icssPluginUsed) {
    let localsCode = "";
    const addExportToLocalsCode = (names, value) => {
      const normalizedNames = Array.isArray(names) ? new Set(names) : new Set([names]);
      for (const name of normalizedNames) {
        if (options.modules.namedExport) {
          localsCode += `export var ${name} = ${isTemplateLiteralSupported ? convertToTemplateLiteral(value) : JSON.stringify(value)};\n`;
        } else {
          if (localsCode) {
            localsCode += `,\n`;
          }
          localsCode += `\t${JSON.stringify(name)}: ${isTemplateLiteralSupported ? convertToTemplateLiteral(value) : JSON.stringify(value)}`;
        }
      }
    };
    for (const {
      name,
      value
    } of exports) {
      addExportToLocalsCode(options.modules.exportLocalsConvention(name), value);
    }
    for (const item of replacements) {
      const {
        replacementName,
        localName
      } = item;
      if (localName) {
        const {
          importName
        } = item;
        localsCode = localsCode.replace(new RegExp(replacementName, "g"), () => {
          if (options.modules.namedExport) {
            return isTemplateLiteralSupported ? `\${${importName}_NAMED___[${JSON.stringify(getValidLocalName(localName, options.modules.exportLocalsConvention))}]}` : `" + ${importName}_NAMED___[${JSON.stringify(getValidLocalName(localName, options.modules.exportLocalsConvention))}] + "`;
          } else if (options.modules.exportOnlyLocals) {
            return isTemplateLiteralSupported ? `\${${importName}[${JSON.stringify(localName)}]}` : `" + ${importName}[${JSON.stringify(localName)}] + "`;
          }
          return isTemplateLiteralSupported ? `\${${importName}.locals[${JSON.stringify(localName)}]}` : `" + ${importName}.locals[${JSON.stringify(localName)}] + "`;
        });
      } else {
        localsCode = localsCode.replace(new RegExp(replacementName, "g"), () => isTemplateLiteralSupported ? `\${${replacementName}}` : `" + ${replacementName} + "`);
      }
    }
    if (options.modules.exportOnlyLocals) {
      code += options.modules.namedExport ? localsCode : `${options.esModule ? "export default" : "module.exports ="} {\n${localsCode}\n};\n`;
      return code;
    }
    code += options.modules.namedExport ? localsCode : `___CSS_LOADER_EXPORT___.locals = {${localsCode ? `\n${localsCode}\n` : ""}};\n`;
  }
  const isCSSStyleSheetExport = options.exportType === "css-style-sheet";
  if (isCSSStyleSheetExport) {
    code += "var ___CSS_LOADER_STYLE_SHEET___ = new CSSStyleSheet();\n";
    code += "___CSS_LOADER_STYLE_SHEET___.replaceSync(___CSS_LOADER_EXPORT___.toString());\n";
  }
  let finalExport;
  switch (options.exportType) {
    case "string":
      finalExport = "___CSS_LOADER_EXPORT___.toString()";
      break;
    case "css-style-sheet":
      finalExport = "___CSS_LOADER_STYLE_SHEET___";
      break;
    default:
    case "array":
      finalExport = "___CSS_LOADER_EXPORT___";
      break;
  }
  code += `${options.esModule ? "export default" : "module.exports ="} ${finalExport};\n`;
  return code;
}
async function resolveRequests(resolve, context, possibleRequests) {
  return resolve(context, possibleRequests[0]).then(result => result).catch(error => {
    const [, ...tailPossibleRequests] = possibleRequests;
    if (tailPossibleRequests.length === 0) {
      throw error;
    }
    return resolveRequests(resolve, context, tailPossibleRequests);
  });
}
function isURLRequestable(url, options = {}) {
  // Protocol-relative URLs
  if (/^\/\//.test(url)) {
    return {
      requestable: false,
      needResolve: false
    };
  }

  // `#` URLs
  if (/^#/.test(url)) {
    return {
      requestable: false,
      needResolve: false
    };
  }

  // Data URI
  if (isDataUrl(url) && options.isSupportDataURL) {
    try {
      decodeURIComponent(url);
    } catch (ignoreError) {
      return {
        requestable: false,
        needResolve: false
      };
    }
    return {
      requestable: true,
      needResolve: false
    };
  }

  // `file:` protocol
  if (/^file:/i.test(url)) {
    return {
      requestable: true,
      needResolve: true
    };
  }

  // Absolute URLs
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !NATIVE_WIN32_PATH.test(url)) {
    if (options.isSupportAbsoluteURL && /^https?:/i.test(url)) {
      return {
        requestable: true,
        needResolve: false
      };
    }
    return {
      requestable: false,
      needResolve: false
    };
  }
  return {
    requestable: true,
    needResolve: true
  };
}
function sort(a, b) {
  return a.index - b.index;
}
function combineRequests(preRequest, url) {
  const idx = url.indexOf("!=!");
  return idx !== -1 ? url.slice(0, idx + 3) + preRequest + url.slice(idx + 3) : preRequest + url;
}
function warningFactory(warning) {
  let message = "";
  if (typeof warning.line !== "undefined") {
    message += `(${warning.line}:${warning.column}) `;
  }
  if (typeof warning.plugin !== "undefined") {
    message += `from "${warning.plugin}" plugin: `;
  }
  message += warning.text;
  if (warning.node) {
    message += `\n\nCode:\n  ${warning.node.toString()}\n`;
  }
  const obj = new Error(message, {
    cause: warning
  });
  obj.stack = null;
  return obj;
}
function syntaxErrorFactory(error) {
  let message = "\nSyntaxError\n\n";
  if (typeof error.line !== "undefined") {
    message += `(${error.line}:${error.column}) `;
  }
  if (typeof error.plugin !== "undefined") {
    message += `from "${error.plugin}" plugin: `;
  }
  message += error.file ? `${error.file} ` : "<css input> ";
  message += `${error.reason}`;
  const code = error.showSourceCode();
  if (code) {
    message += `\n\n${code}\n`;
  }
  const obj = new Error(message, {
    cause: error
  });
  obj.stack = null;
  return obj;
}