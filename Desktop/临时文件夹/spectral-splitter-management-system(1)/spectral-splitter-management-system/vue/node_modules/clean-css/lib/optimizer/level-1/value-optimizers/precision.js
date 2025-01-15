var plugin = {
  level1: {
    value: function precision(_name, value, options) {
      if (!options.precision.enabled || value.indexOf('.') === -1) {
        return value;
      }

      return value
        .replace(options.precision.decimalPointMatcher, '$1$2$3')
        .replace(options.precision.zeroMatcher, function(match, integerPart, fractionPart, unit) {
          var multiplier = options.precision.units[unit].multiplier;
          var parsedInteger = parseInt(integerPart);
          var integer = Number.isNaN(parsedInteger) ? 0 : parsedInteger;
          var fraction = parseFloat(fractionPart);

          return Math.round((integer + fraction) * multiplier) / multiplier + unit;
        });
    }
  }
};

module.exports = plugin;
