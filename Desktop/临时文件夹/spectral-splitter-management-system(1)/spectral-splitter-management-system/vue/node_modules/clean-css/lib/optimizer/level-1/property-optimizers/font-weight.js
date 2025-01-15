var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var plugin = {
  level1: {
    property: function fontWeight(_rule, property, options) {
      var value = property.value[0][1];

      if (!options.level[OptimizationLevel.One].optimizeFontWeight) {
        return;
      }

      if (value == 'normal') {
        value = '400';
      } else if (value == 'bold') {
        value = '700';
      }

      property.value[0][1] = value;
    }
  }
};

module.exports = plugin;
