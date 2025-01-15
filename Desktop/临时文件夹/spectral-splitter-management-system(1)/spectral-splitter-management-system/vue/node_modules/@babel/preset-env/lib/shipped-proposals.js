"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.proposalSyntaxPlugins = exports.proposalPlugins = exports.pluginSyntaxMap = void 0;
const proposalPlugins = new Set();
exports.proposalPlugins = proposalPlugins;
const proposalSyntaxPlugins = ["syntax-import-assertions", "syntax-import-attributes"];
exports.proposalSyntaxPlugins = proposalSyntaxPlugins;
const pluginSyntaxObject = {
  "transform-async-generator-functions": "syntax-async-generators",
  "transform-class-properties": "syntax-class-properties",
  "transform-class-static-block": "syntax-class-static-block",
  "transform-json-strings": "syntax-json-strings",
  "transform-nullish-coalescing-operator": "syntax-nullish-coalescing-operator",
  "transform-numeric-separator": "syntax-numeric-separator",
  "transform-object-rest-spread": "syntax-object-rest-spread",
  "transform-optional-catch-binding": "syntax-optional-catch-binding",
  "transform-optional-chaining": "syntax-optional-chaining",
  "transform-private-methods": "syntax-class-properties",
  "transform-private-property-in-object": "syntax-private-property-in-object",
  "transform-unicode-property-regex": null
};
const pluginSyntaxEntries = Object.keys(pluginSyntaxObject).map(function (key) {
  return [key, pluginSyntaxObject[key]];
});
const pluginSyntaxMap = new Map(pluginSyntaxEntries);
exports.pluginSyntaxMap = pluginSyntaxMap;

//# sourceMappingURL=shipped-proposals.js.map
