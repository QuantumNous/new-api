var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var LOCAL_PREFIX_PATTERN = /^local\(/i;
var QUOTED_PATTERN = /^('.*'|".*")$/;
var QUOTED_BUT_SAFE_PATTERN = /^['"][a-zA-Z][a-zA-Z\d\-_]+['"]$/;
// eslint-disable-next-line max-len
var GENERIC_FONT_FAMILY_PATTERN = /^['"](?:cursive|default|emoji|fangsong|fantasy|inherit|initial|math|monospace|revert|revert-layer|sans-serif|serif|system-ui|ui-monospace|ui-rounded|ui-sans-serif|ui-serif|unset)['"]$/;

var plugin = {
  level1: {
    value: function textQuotes(name, value, options) {
      if ((name == 'font-family' || name == 'font') && GENERIC_FONT_FAMILY_PATTERN.test(value)) {
        return value;
      }

      if (!options.level[OptimizationLevel.One].removeQuotes) {
        return value;
      }

      if (!QUOTED_PATTERN.test(value) && !LOCAL_PREFIX_PATTERN.test(value)) {
        return value;
      }

      return QUOTED_BUT_SAFE_PATTERN.test(value)
        ? value.substring(1, value.length - 1)
        : value;
    }
  }
};

module.exports = plugin;
