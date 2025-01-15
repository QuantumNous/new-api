var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var ALPHA_OR_CHROMA_FILTER_PATTERN = /progid:DXImageTransform\.Microsoft\.(Alpha|Chroma)(\W)/;
var NO_SPACE_AFTER_COMMA_PATTERN = /,(\S)/g;
var WHITESPACE_AROUND_EQUALS_PATTERN = / ?= ?/g;

var plugin = {
  level1: {
    property: function filter(_rule, property, options) {
      if (!options.compatibility.properties.ieFilters) {
        return;
      }

      if (!options.level[OptimizationLevel.One].optimizeFilter) {
        return;
      }

      if (property.value.length == 1) {
        property.value[0][1] = property.value[0][1].replace(
          ALPHA_OR_CHROMA_FILTER_PATTERN,
          function(match, filter, suffix) {
            return filter.toLowerCase() + suffix;
          }
        );
      }

      property.value[0][1] = property.value[0][1]
        .replace(NO_SPACE_AFTER_COMMA_PATTERN, ', $1')
        .replace(WHITESPACE_AROUND_EQUALS_PATTERN, '=');
    }
  }
};

module.exports = plugin;
