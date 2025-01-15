var split = require('../../../utils/split');
var startsAsUrl = require('./starts-as-url');

var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var EXPRESSION_PATTERN = /^expression\(.*\)$/;
var ANY_FUNCTION_PATTERN = /^(-(?:moz|ms|o|webkit)-[a-z-]+|[a-z-]+)\((.+)\)$/;
var TOKEN_SEPARATOR_PATTERN = /([\s,/])/;

var DOT_ZERO_PATTERN = /(^|\D)\.0+(\D|$)/g;
var FRACTION_PATTERN = /\.([1-9]*)0+(\D|$)/g;
var LEADING_ZERO_FRACTION_PATTERN = /(^|\D)0\.(\d)/g;
var MINUS_ZERO_FRACTION_PATTERN = /([^\w\d-]|^)-0([^.]|$)/g;
var ZERO_PREFIXED_UNIT_PATTERN = /(^|\s)0+([1-9])/g;

function optimizeRecursively(value) {
  var functionTokens;
  var tokens;

  if (startsAsUrl(value)) {
    return value;
  }

  if (EXPRESSION_PATTERN.test(value)) {
    return value;
  }

  functionTokens = ANY_FUNCTION_PATTERN.exec(value);

  if (!functionTokens) {
    return optimizeFractions(value);
  }

  tokens = split(functionTokens[2], TOKEN_SEPARATOR_PATTERN)
    .map(function(token) { return optimizeRecursively(token); });

  return functionTokens[1] + '(' + tokens.join('') + ')';
}

function optimizeFractions(value) {
  if (value.indexOf('0') == -1) {
    return value;
  }

  if (value.indexOf('-') > -1) {
    value = value
      .replace(MINUS_ZERO_FRACTION_PATTERN, '$10$2')
      .replace(MINUS_ZERO_FRACTION_PATTERN, '$10$2');
  }

  return value
    .replace(ZERO_PREFIXED_UNIT_PATTERN, '$1$2')
    .replace(DOT_ZERO_PATTERN, '$10$2')
    .replace(FRACTION_PATTERN, function(match, nonZeroPart, suffix) {
      return (nonZeroPart.length > 0 ? '.' : '') + nonZeroPart + suffix;
    })
    .replace(LEADING_ZERO_FRACTION_PATTERN, '$1.$2');
}

var plugin = {
  level1: {
    value: function fraction(name, value, options) {
      if (!options.level[OptimizationLevel.One].replaceZeroUnits) {
        return value;
      }

      return optimizeRecursively(value);
    }
  }
};

module.exports = plugin;
