var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var Marker = require('../../../tokenizer/marker');

var CALC_DIVISION_WHITESPACE_PATTERN = /\) ?\/ ?/g;
var COMMA_AND_SPACE_PATTERN = /, /g;
var LINE_BREAK_PATTERN = /\r?\n/g;
var MULTI_WHITESPACE_PATTERN = /\s+/g;
var FUNCTION_CLOSING_BRACE_WHITESPACE_PATTERN = /\s+(;?\))/g;
var FUNCTION_OPENING_BRACE_WHITESPACE_PATTERN = /(\(;?)\s+/g;
var VARIABLE_NAME_PATTERN = /^--\S+$/;
var VARIABLE_VALUE_PATTERN = /^var\(\s*--\S+\s*\)$/;

var plugin = {
  level1: {
    value: function whitespace(name, value, options) {
      if (!options.level[OptimizationLevel.One].removeWhitespace) {
        return value;
      }

      if (VARIABLE_NAME_PATTERN.test(name) && !VARIABLE_VALUE_PATTERN.test(value)) {
        return value;
      }

      if ((value.indexOf(' ') == -1 && value.indexOf('\n') == -1) || value.indexOf('expression') === 0) {
        return value;
      }

      if (value.indexOf(Marker.SINGLE_QUOTE) > -1 || value.indexOf(Marker.DOUBLE_QUOTE) > -1) {
        return value;
      }

      value = value.replace(LINE_BREAK_PATTERN, '');
      value = value.replace(MULTI_WHITESPACE_PATTERN, ' ');

      if (value.indexOf('calc') > -1) {
        value = value.replace(CALC_DIVISION_WHITESPACE_PATTERN, ')/ ');
      }

      return value
        .replace(FUNCTION_OPENING_BRACE_WHITESPACE_PATTERN, '$1')
        .replace(FUNCTION_CLOSING_BRACE_WHITESPACE_PATTERN, '$1')
        .replace(COMMA_AND_SPACE_PATTERN, ',');
    }
  }
};

module.exports = plugin;
