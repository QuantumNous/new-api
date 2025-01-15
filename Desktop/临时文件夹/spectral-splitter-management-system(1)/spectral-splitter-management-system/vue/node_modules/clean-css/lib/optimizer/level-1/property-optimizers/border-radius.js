var OptimizationLevel = require('../../../options/optimization-level').OptimizationLevel;

var plugin = {
  level1: {
    property: function borderRadius(_rule, property, options) {
      var values = property.value;

      if (!options.level[OptimizationLevel.One].optimizeBorderRadius) {
        return;
      }

      if (values.length == 3 && values[1][1] == '/' && values[0][1] == values[2][1]) {
        property.value.splice(1);
        property.dirty = true;
      } else if (values.length == 5 && values[2][1] == '/' && values[0][1] == values[3][1] && values[1][1] == values[4][1]) {
        property.value.splice(2);
        property.dirty = true;
      } else if (values.length == 7 && values[3][1] == '/' && values[0][1] == values[4][1] && values[1][1] == values[5][1] && values[2][1] == values[6][1]) {
        property.value.splice(3);
        property.dirty = true;
      } else if (values.length == 9 && values[4][1] == '/' && values[0][1] == values[5][1] && values[1][1] == values[6][1] && values[2][1] == values[7][1] && values[3][1] == values[8][1]) {
        property.value.splice(4);
        property.dirty = true;
      }
    }
  }
};

module.exports = plugin;
