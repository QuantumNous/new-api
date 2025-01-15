function hasSameValues(property) {
  var firstValue = property.value[0][1];
  var i, l;

  for (i = 1, l = property.value.length; i < l; i++) {
    if (property.value[i][1] != firstValue) {
      return false;
    }
  }

  return true;
}

module.exports = hasSameValues;
