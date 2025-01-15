"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _helperPluginUtils = require("@babel/helper-plugin-utils");
var _pluginSyntaxDecorators = require("@babel/plugin-syntax-decorators");
var _helperCreateClassFeaturesPlugin = require("@babel/helper-create-class-features-plugin");
var _transformerLegacy = require("./transformer-legacy.js");
var _transformer = require("./transformer-2023-05.js");
var _default = (0, _helperPluginUtils.declare)((api, options) => {
  api.assertVersion(7);
  {
    var {
      legacy
    } = options;
  }
  const {
    version
  } = options;
  if (legacy || version === "legacy") {
    return {
      name: "proposal-decorators",
      inherits: _pluginSyntaxDecorators.default,
      visitor: _transformerLegacy.default
    };
  } else if (version === "2021-12" || version === "2022-03" || version === "2023-01" || version === "2023-05") {
    return (0, _transformer.default)(api, options, version);
  } else {
    api.assertVersion("^7.0.2");
    return (0, _helperCreateClassFeaturesPlugin.createClassFeaturePlugin)({
      name: "proposal-decorators",
      api,
      feature: _helperCreateClassFeaturesPlugin.FEATURES.decorators,
      inherits: _pluginSyntaxDecorators.default
    });
  }
});
exports.default = _default;

//# sourceMappingURL=index.js.map
