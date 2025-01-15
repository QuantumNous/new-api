var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var plugin = {
  level1: {
    property: function background(_rule, property, options) {
      var values = property.value;

      if (!options.level[OptimizationLevel.One].optimizeBackground) {
        return;
      }

      if (values.length == 1 && values[0][1] == 'none') {
        values[0][1] = '0 0';
      }

      if (values.length == 1 && values[0][1] == 'transparent') {
        values[0][1] = '0 0';
      }
    }
  }
};

module.exports = plugin;
