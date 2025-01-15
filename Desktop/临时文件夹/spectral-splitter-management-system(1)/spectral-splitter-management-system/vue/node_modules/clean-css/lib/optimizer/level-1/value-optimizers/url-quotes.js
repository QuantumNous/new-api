var QUOTED_URL_PATTERN = /^url\(['"].+['"]\)$/;
var QUOTED_URL_WITH_WHITESPACE_PATTERN = /^url\(['"].*[*\s()'"].*['"]\)$/;
var QUOTES_PATTERN = /["']/g;
var URL_DATA_PATTERN = /^url\(['"]data:[^;]+;charset/;

var plugin = {
  level1: {
    value: function urlQuotes(_name, value, options) {
      if (options.compatibility.properties.urlQuotes) {
        return value;
      }

      return QUOTED_URL_PATTERN.test(value)
        && !QUOTED_URL_WITH_WHITESPACE_PATTERN.test(value)
        && !URL_DATA_PATTERN.test(value)
        ? value.replace(QUOTES_PATTERN, '')
        : value;
    }
  }
};

module.exports = plugin;
