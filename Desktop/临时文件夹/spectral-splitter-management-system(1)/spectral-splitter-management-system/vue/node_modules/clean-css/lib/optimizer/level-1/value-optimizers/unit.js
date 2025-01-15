var WHOLE_PIXEL_VALUE = /(?:^|\s|\()(-?\d+)px/;

var plugin = {
  level1: {
    value: function unit(_name, value, options) {
      if (!WHOLE_PIXEL_VALUE.test(value)) {
        return value;
      }

      return value.replace(WHOLE_PIXEL_VALUE, function(match, val) {
        var newValue;
        var intVal = parseInt(val);

        if (intVal === 0) {
          return match;
        }

        if (options.compatibility.properties.shorterLengthUnits
          && options.compatibility.units.pt
          && intVal * 3 % 4 === 0) {
          newValue = intVal * 3 / 4 + 'pt';
        }

        if (options.compatibility.properties.shorterLengthUnits
          && options.compatibility.units.pc
          && intVal % 16 === 0) {
          newValue = intVal / 16 + 'pc';
        }

        if (options.compatibility.properties.shorterLengthUnits
          && options.compatibility.units.in
          && intVal % 96 === 0) {
          newValue = intVal / 96 + 'in';
        }

        if (newValue) {
          newValue = match.substring(0, match.indexOf(val)) + newValue;
        }

        return newValue && newValue.length < match.length ? newValue : match;
      });
    }
  }
};

module.exports = plugin;
