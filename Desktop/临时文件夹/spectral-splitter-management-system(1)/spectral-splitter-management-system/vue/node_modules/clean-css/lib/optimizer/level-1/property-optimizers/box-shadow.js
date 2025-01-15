var plugin = {
  level1: {
    property: function boxShadow(_rule, property) {
      var values = property.value;

      // remove multiple zeros
      if (values.length == 4 && values[0][1] === '0' && values[1][1] === '0' && values[2][1] === '0' && values[3][1] === '0') {
        property.value.splice(2);
        property.dirty = true;
      }
    }
  }
};

module.exports = plugin;
