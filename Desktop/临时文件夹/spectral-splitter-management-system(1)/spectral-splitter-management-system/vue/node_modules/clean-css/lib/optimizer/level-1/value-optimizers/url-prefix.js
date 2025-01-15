var startsAsUrl = require('./starts-as-url');

var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var URL_PREFIX_PATTERN = /^url\(/i;

var plugin = {
  level1: {
    value: function urlPrefix(_name, value, options) {
      if (!options.level[OptimizationLevel.One].normalizeUrls) {
        return value;
      }

      if (!startsAsUrl(value)) {
        return value;
      }

      return value.replace(URL_PREFIX_PATTERN, 'url(');
    }
  }
};

module.exports = plugin;
