var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var plugin = {
  level1: {
    property: function outline(_rule, property, options) {
      var values = property.value;

      if (!options.level[OptimizationLevel.One].optimizeOutline) {
        return;
      }

      if (values.length == 1 && values[0][1] == 'none') {
        values[0][1] = '0';
      }
    }
  }
};

module.exports = plugin;
