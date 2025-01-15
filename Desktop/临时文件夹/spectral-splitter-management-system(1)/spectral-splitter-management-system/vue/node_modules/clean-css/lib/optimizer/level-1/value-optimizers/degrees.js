var ZERO_DEG_PATTERN = /\(0deg\)/g;

var plugin = {
  level1: {
    value: function degrees(_name, value, options) {
      if (!options.compatibility.properties.zeroUnits) {
        return value;
      }

      if (value.indexOf('0deg') == -1) {
        return value;
      }

      return value.replace(ZERO_DEG_PATTERN, '(0)');
    }
  }
};

module.exports = plugin;
