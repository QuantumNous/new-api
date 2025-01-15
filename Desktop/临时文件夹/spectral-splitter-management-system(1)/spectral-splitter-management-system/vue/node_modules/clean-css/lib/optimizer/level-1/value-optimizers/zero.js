var split = require('../../../utils/split');

var ANY_FUNCTION_PATTERN = /^(-(?:moz|ms|o|webkit)-[a-z-]+|[a-z-]+)\((.+)\)$/;
var SKIP_FUNCTION_PATTERN = /^(?:-moz-calc|-webkit-calc|calc|rgb|hsl|rgba|hsla|min|max|clamp|expression)\(/;
var TOKEN_SEPARATOR_PATTERN = /([\s,/])/;

function removeRecursively(value, options) {
  var functionTokens;
  var tokens;

  if (SKIP_FUNCTION_PATTERN.test(value)) {
    return value;
  }

  functionTokens = ANY_FUNCTION_PATTERN.exec(value);

  if (!functionTokens) {
    return removeZeros(value, options);
  }

  tokens = split(functionTokens[2], TOKEN_SEPARATOR_PATTERN)
    .map(function(token) { return removeRecursively(token, options); });

  return functionTokens[1] + '(' + tokens.join('') + ')';
}

function removeZeros(value, options) {
  return value
    .replace(options.unitsRegexp, '$10$2')
    .replace(options.unitsRegexp, '$10$2');
}

var plugin = {
  level1: {
    value: function zero(name, value, options) {
      if (!options.compatibility.properties.zeroUnits) {
        return value;
      }

      if (value.indexOf('%') > 0 && (name == 'height' || name == 'max-height' || name == 'width' || name == 'max-width')) {
        return value;
      }

      return removeRecursively(value, options);
    }
  }
};

module.exports = plugin;
