function hasUnset(property) {
  for (var i = property.value.length - 1; i >= 0; i--) {
    if (property.value[i][1] == 'unset') { return true; }
  }

  return false;
}

module.exports = hasUnset;
