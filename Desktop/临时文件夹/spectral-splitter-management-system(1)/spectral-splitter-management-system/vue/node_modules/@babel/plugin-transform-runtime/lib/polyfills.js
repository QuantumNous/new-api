"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createBasePolyfillsPlugin = createBasePolyfillsPlugin;
var _babelPluginPolyfillCorejs = require("babel-plugin-polyfill-corejs2");
var _babelPluginPolyfillCorejs2 = require("babel-plugin-polyfill-corejs3");
var _babelPluginPolyfillRegenerator = require("babel-plugin-polyfill-regenerator");
const pluginCorejs2 = _babelPluginPolyfillCorejs.default || _babelPluginPolyfillCorejs;
const pluginCorejs3 = _babelPluginPolyfillCorejs2.default || _babelPluginPolyfillCorejs2;
const pluginRegenerator = _babelPluginPolyfillRegenerator.default || _babelPluginPolyfillRegenerator;
const pluginsCompat = "#__secret_key__@babel/runtime__compatibility";
function createCorejsPlugin(plugin, options, regeneratorPlugin) {
  return (api, _, filename) => {
    return Object.assign({}, plugin(api, options, filename), {
      inherits: regeneratorPlugin
    });
  };
}
function createRegeneratorPlugin(options, useRuntimeRegenerator) {
  if (!useRuntimeRegenerator) return undefined;
  return (api, _, filename) => {
    return pluginRegenerator(api, options, filename);
  };
}
function createBasePolyfillsPlugin({
  corejs,
  regenerator: useRuntimeRegenerator = true
}, runtimeVersion, absoluteImports) {
  let proposals = false;
  let rawVersion;
  if (typeof corejs === "object" && corejs !== null) {
    rawVersion = corejs.version;
    proposals = Boolean(corejs.proposals);
  } else {
    rawVersion = corejs;
  }
  const corejsVersion = rawVersion ? Number(rawVersion) : false;
  if (![false, 2, 3].includes(corejsVersion)) {
    throw new Error(`The \`core-js\` version must be false, 2 or 3, but got ${JSON.stringify(rawVersion)}.`);
  }
  if (proposals && (!corejsVersion || corejsVersion < 3)) {
    throw new Error("The 'proposals' option is only supported when using 'corejs: 3'");
  }
  if (typeof useRuntimeRegenerator !== "boolean") {
    throw new Error("The 'regenerator' option must be undefined, or a boolean.");
  }
  const polyfillOpts = {
    method: "usage-pure",
    absoluteImports,
    [pluginsCompat]: {
      useBabelRuntime: true,
      runtimeVersion,
      ext: ""
    }
  };
  return corejsVersion === 2 ? createCorejsPlugin(pluginCorejs2, polyfillOpts, createRegeneratorPlugin(polyfillOpts, useRuntimeRegenerator)) : corejsVersion === 3 ? createCorejsPlugin(pluginCorejs3, Object.assign({
    version: 3,
    proposals
  }, polyfillOpts), createRegeneratorPlugin(polyfillOpts, useRuntimeRegenerator)) : createRegeneratorPlugin(polyfillOpts, useRuntimeRegenerator);
}

//# sourceMappingURL=polyfills.js.map
