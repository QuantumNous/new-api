var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var TIME_VALUE = /^(-?[\d.]+)(m?s)$/;

var plugin = {
  level1: {
    value: function time(name, value, options) {
      if (!options.level[OptimizationLevel.One].replaceTimeUnits) {
        return value;
      }

      if (!TIME_VALUE.test(value)) {
        return value;
      }

      return value.replace(TIME_VALUE, function(match, val, unit) {
        var newValue;

        if (unit == 'ms') {
          newValue = parseInt(val) / 1000 + 's';
        } else if (unit == 's') {
          newValue = parseFloat(val) * 1000 + 'ms';
        }

        return newValue.length < match.length ? newValue : match;
      });
    }
  }
};

module.exports = plugin;
