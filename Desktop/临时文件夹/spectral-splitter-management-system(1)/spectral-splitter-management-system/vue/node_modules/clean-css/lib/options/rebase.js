function rebaseFrom(rebaseOption, rebaseToOption) {
  if (undefined !== rebaseToOption) {
    return true;
  } if (undefined === rebaseOption) {
    return false;
  }
  return !!rebaseOption;
}

module.exports = rebaseFrom;
