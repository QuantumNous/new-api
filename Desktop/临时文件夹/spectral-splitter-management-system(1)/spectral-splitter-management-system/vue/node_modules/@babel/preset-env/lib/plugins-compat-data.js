"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.pluginsBugfixes = exports.plugins = exports.overlappingPlugins = void 0;
var _plugins = require("@babel/compat-data/plugins");
var _pluginBugfixes = require("@babel/compat-data/plugin-bugfixes");
var _overlappingPlugins = require("@babel/compat-data/overlapping-plugins");
var _availablePlugins = require("./available-plugins.js");
const keys = Object.keys;
const plugins = filterAvailable(_plugins);
exports.plugins = plugins;
const pluginsBugfixes = filterAvailable(_pluginBugfixes);
exports.pluginsBugfixes = pluginsBugfixes;
const overlappingPlugins = filterAvailable(_overlappingPlugins);
exports.overlappingPlugins = overlappingPlugins;
overlappingPlugins["syntax-import-attributes"] = ["syntax-import-assertions"];
function filterAvailable(data) {
  const result = {};
  for (const plugin of keys(data)) {
    if (Object.hasOwnProperty.call(_availablePlugins.default, plugin)) {
      result[plugin] = data[plugin];
    }
  }
  return result;
}

//# sourceMappingURL=plugins-compat-data.js.map
