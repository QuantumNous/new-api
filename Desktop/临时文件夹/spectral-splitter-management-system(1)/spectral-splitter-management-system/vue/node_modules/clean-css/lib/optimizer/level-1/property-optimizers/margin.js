var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var plugin = {
  level1: {
    property: function margin(_rule, property, options) {
      var values = property.value;

      if (!options.level[OptimizationLevel.One].replaceMultipleZeros) {
        return;
      }

      // remove multiple zeros
      if (values.length == 4 && values[0][1] === '0' && values[1][1] === '0' && values[2][1] === '0' && values[3][1] === '0') {
        property.value.splice(1);
        property.dirty = true;
      }
    }
  }
};

module.exports = plugin;
