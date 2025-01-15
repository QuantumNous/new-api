var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

function isNegative(value) {
  return value && value[1][0] == '-' && parseFloat(value[1]) < 0;
}

var plugin = {
  level1: {
    property: function padding(_rule, property, options) {
      var values = property.value;

      // remove multiple zeros
      if (values.length == 4 && values[0][1] === '0' && values[1][1] === '0' && values[2][1] === '0' && values[3][1] === '0') {
        property.value.splice(1);
        property.dirty = true;
      }

      // remove negative paddings
      if (options.level[OptimizationLevel.One].removeNegativePaddings
        && (
          isNegative(property.value[0])
          || isNegative(property.value[1])
          || isNegative(property.value[2])
          || isNegative(property.value[3])
        )) {
        property.unused = true;
      }
    }
  }
};

module.exports = plugin;
