var sortSelectors = require('./sort-selectors');
var tidyRules = require('./tidy-rules');
var tidyBlock = require('./tidy-block');
var tidyAtRule = require('./tidy-at-rule');

var Hack = require('../hack');
var removeUnused = require('../remove-unused');
var restoreFromOptimizing = require('../restore-from-optimizing');
var wrapForOptimizing = require('../wrap-for-optimizing').all;

var configuration = require('../configuration');
var optimizers = require('./value-optimizers');

var OptimizationLevel = require('../../options/optimization-level').OptimizationLevel;

var Token = require('../../tokenizer/token');
var Marker = require('../../tokenizer/marker');

var formatPosition = require('../../utils/format-position');

var serializeRules = require('../../writer/one-time').rules;

var CHARSET_TOKEN = '@charset';
var CHARSET_REGEXP = new RegExp('^' + CHARSET_TOKEN, 'i');

var DEFAULT_ROUNDING_PRECISION = require('../../options/rounding-precision').DEFAULT;

var VARIABLE_PROPERTY_NAME_PATTERN = /^--\S+$/;
var PROPERTY_NAME_PATTERN = /^(?:-chrome-|-[\w-]+\w|\w[\w-]+\w|\w{1,})$/;
var IMPORT_PREFIX_PATTERN = /^@import/i;
var URL_PREFIX_PATTERN = /^url\(/i;

function startsAsUrl(value) {
  return URL_PREFIX_PATTERN.test(value);
}

function isImport(token) {
  return IMPORT_PREFIX_PATTERN.test(token[1]);
}

function isLegacyFilter(property) {
  var value;

  if (property.name == 'filter' || property.name == '-ms-filter') {
    value = property.value[0][1];

    return value.indexOf('progid') > -1
      || value.indexOf('alpha') === 0
      || value.indexOf('chroma') === 0;
  }
  return false;
}

function noop() {}

function noopValueOptimizer(_name, value, _options) { return value; }

function optimizeBody(rule, properties, context) {
  var options = context.options;
  var valueOptimizers;
  var property, name, type, value;
  var propertyToken;
  var propertyOptimizer;
  var serializedRule = serializeRules(rule);
  var _properties = wrapForOptimizing(properties);
  var pluginValueOptimizers = context.options.plugins.level1Value;
  var pluginPropertyOptimizers = context.options.plugins.level1Property;
  var isVariable;
  var i, l;

  for (i = 0, l = _properties.length; i < l; i++) {
    var j, k, m, n;

    property = _properties[i];
    name = property.name;
    propertyOptimizer = configuration[name] && configuration[name].propertyOptimizer || noop;
    valueOptimizers = configuration[name] && configuration[name].valueOptimizers || [optimizers.whiteSpace];
    isVariable = VARIABLE_PROPERTY_NAME_PATTERN.test(name);

    if (isVariable) {
      valueOptimizers = options.variableOptimizers.length > 0
        ? options.variableOptimizers
        : [optimizers.whiteSpace];
    }

    if (!isVariable && !PROPERTY_NAME_PATTERN.test(name)) {
      propertyToken = property.all[property.position];
      context.warnings.push('Invalid property name \'' + name + '\' at ' + formatPosition(propertyToken[1][2][0]) + '. Ignoring.');
      property.unused = true;
      continue;
    }

    if (property.value.length === 0) {
      propertyToken = property.all[property.position];
      context.warnings.push('Empty property \'' + name + '\' at ' + formatPosition(propertyToken[1][2][0]) + '. Ignoring.');
      property.unused = true;
      continue;
    }

    if (property.hack && (
      (property.hack[0] == Hack.ASTERISK || property.hack[0] == Hack.UNDERSCORE)
        && !options.compatibility.properties.iePrefixHack
        || property.hack[0] == Hack.BACKSLASH && !options.compatibility.properties.ieSuffixHack
        || property.hack[0] == Hack.BANG && !options.compatibility.properties.ieBangHack)) {
      property.unused = true;
      continue;
    }

    if (!options.compatibility.properties.ieFilters && isLegacyFilter(property)) {
      property.unused = true;
      continue;
    }

    if (property.block) {
      optimizeBody(rule, property.value[0][1], context);
      continue;
    }

    for (j = 0, m = property.value.length; j < m; j++) {
      type = property.value[j][0];
      value = property.value[j][1];

      if (type == Token.PROPERTY_BLOCK) {
        property.unused = true;
        context.warnings.push('Invalid value token at ' + formatPosition(value[0][1][2][0]) + '. Ignoring.');
        break;
      }

      if (startsAsUrl(value) && !context.validator.isUrl(value)) {
        property.unused = true;
        context.warnings.push('Broken URL \'' + value + '\' at ' + formatPosition(property.value[j][2][0]) + '. Ignoring.');
        break;
      }

      for (k = 0, n = valueOptimizers.length; k < n; k++) {
        value = valueOptimizers[k](name, value, options);
      }

      for (k = 0, n = pluginValueOptimizers.length; k < n; k++) {
        value = pluginValueOptimizers[k](name, value, options);
      }

      property.value[j][1] = value;
    }

    propertyOptimizer(serializedRule, property, options);

    for (j = 0, m = pluginPropertyOptimizers.length; j < m; j++) {
      pluginPropertyOptimizers[j](serializedRule, property, options);
    }
  }

  restoreFromOptimizing(_properties);
  removeUnused(_properties);
  removeComments(properties, options);
}

function removeComments(tokens, options) {
  var token;
  var i;

  for (i = 0; i < tokens.length; i++) {
    token = tokens[i];

    if (token[0] != Token.COMMENT) {
      continue;
    }

    optimizeComment(token, options);

    if (token[1].length === 0) {
      tokens.splice(i, 1);
      i--;
    }
  }
}

function optimizeComment(token, options) {
  if (token[1][2] == Marker.EXCLAMATION && (options.level[OptimizationLevel.One].specialComments == 'all' || options.commentsKept < options.level[OptimizationLevel.One].specialComments)) {
    options.commentsKept++;
    return;
  }

  token[1] = [];
}

function cleanupCharsets(tokens) {
  var hasCharset = false;

  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    if (token[0] != Token.AT_RULE) { continue; }

    if (!CHARSET_REGEXP.test(token[1])) { continue; }

    if (hasCharset || token[1].indexOf(CHARSET_TOKEN) == -1) {
      tokens.splice(i, 1);
      i--;
      l--;
    } else {
      hasCharset = true;
      tokens.splice(i, 1);
      tokens.unshift([Token.AT_RULE, token[1].replace(CHARSET_REGEXP, CHARSET_TOKEN)]);
    }
  }
}

function buildUnitRegexp(options) {
  var units = ['px', 'em', 'ex', 'cm', 'mm', 'in', 'pt', 'pc', '%'];
  var otherUnits = ['ch', 'rem', 'vh', 'vm', 'vmax', 'vmin', 'vw'];

  otherUnits.forEach(function(unit) {
    if (options.compatibility.units[unit]) {
      units.push(unit);
    }
  });

  return new RegExp('(^|\\s|\\(|,)0(?:' + units.join('|') + ')(\\W|$)', 'g');
}

function buildPrecisionOptions(roundingPrecision) {
  var precisionOptions = {
    matcher: null,
    units: {}
  };
  var optimizable = [];
  var unit;
  var value;

  for (unit in roundingPrecision) {
    value = roundingPrecision[unit];

    if (value != DEFAULT_ROUNDING_PRECISION) {
      precisionOptions.units[unit] = {};
      precisionOptions.units[unit].value = value;
      precisionOptions.units[unit].multiplier = 10 ** value;

      optimizable.push(unit);
    }
  }

  if (optimizable.length > 0) {
    precisionOptions.enabled = true;
    precisionOptions.decimalPointMatcher = new RegExp('(\\d)\\.($|' + optimizable.join('|') + ')($|\\W)', 'g');
    precisionOptions.zeroMatcher = new RegExp('(\\d*)(\\.\\d+)(' + optimizable.join('|') + ')', 'g');
  }

  return precisionOptions;
}

function buildVariableOptimizers(options) {
  return options.level[OptimizationLevel.One].variableValueOptimizers.map(function(optimizer) {
    if (typeof (optimizer) == 'string') {
      return optimizers[optimizer] || noopValueOptimizer;
    }

    return optimizer;
  });
}

function level1Optimize(tokens, context) {
  var options = context.options;
  var levelOptions = options.level[OptimizationLevel.One];
  var ie7Hack = options.compatibility.selectors.ie7Hack;
  var adjacentSpace = options.compatibility.selectors.adjacentSpace;
  var spaceAfterClosingBrace = options.compatibility.properties.spaceAfterClosingBrace;
  var format = options.format;
  var mayHaveCharset = false;
  var afterRules = false;

  options.unitsRegexp = options.unitsRegexp || buildUnitRegexp(options);
  options.precision = options.precision || buildPrecisionOptions(levelOptions.roundingPrecision);
  options.commentsKept = options.commentsKept || 0;
  options.variableOptimizers = options.variableOptimizers || buildVariableOptimizers(options);

  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    switch (token[0]) {
    case Token.AT_RULE:
      token[1] = isImport(token) && afterRules ? '' : token[1];
      token[1] = levelOptions.tidyAtRules ? tidyAtRule(token[1]) : token[1];
      mayHaveCharset = true;
      break;
    case Token.AT_RULE_BLOCK:
      optimizeBody(token[1], token[2], context);
      afterRules = true;
      break;
    case Token.NESTED_BLOCK:
      token[1] = levelOptions.tidyBlockScopes ? tidyBlock(token[1], spaceAfterClosingBrace) : token[1];
      level1Optimize(token[2], context);
      afterRules = true;
      break;
    case Token.COMMENT:
      optimizeComment(token, options);
      break;
    case Token.RULE:
      token[1] = levelOptions.tidySelectors
        ? tidyRules(token[1], !ie7Hack, adjacentSpace, format, context.warnings)
        : token[1];
      token[1] = token[1].length > 1 ? sortSelectors(token[1], levelOptions.selectorsSortingMethod) : token[1];
      optimizeBody(token[1], token[2], context);
      afterRules = true;
      break;
    }

    if (token[0] == Token.COMMENT
      && token[1].length === 0
      || levelOptions.removeEmpty
      && (token[1].length === 0 || (token[2] && token[2].length === 0))) {
      tokens.splice(i, 1);
      i--;
      l--;
    }
  }

  if (levelOptions.cleanupCharsets && mayHaveCharset) {
    cleanupCharsets(tokens);
  }

  return tokens;
}

module.exports = level1Optimize;
