var startsAsUrl = require('./starts-as-url');

var WHITESPACE_PATTERN = /\\?\n|\\?\r\n/g;
var WHITESPACE_PREFIX_PATTERN = /(\()\s+/g;
var WHITESPACE_SUFFIX_PATTERN = /\s+(\))/g;

var plugin = {
  level1: {
    value: function urlWhitespace(_name, value) {
      if (!startsAsUrl(value)) {
        return value;
      }

      return value
        .replace(WHITESPACE_PATTERN, '')
        .replace(WHITESPACE_PREFIX_PATTERN, '$1')
        .replace(WHITESPACE_SUFFIX_PATTERN, '$1');
    }
  }
};

module.exports = plugin;
