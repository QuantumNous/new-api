module.exports = {
  color: require('./value-optimizers/color').level1.value,
  degrees: require('./value-optimizers/degrees').level1.value,
  fraction: require('./value-optimizers/fraction').level1.value,
  precision: require('./value-optimizers/precision').level1.value,
  textQuotes: require('./value-optimizers/text-quotes').level1.value,
  time: require('./value-optimizers/time').level1.value,
  unit: require('./value-optimizers/unit').level1.value,
  urlPrefix: require('./value-optimizers/url-prefix').level1.value,
  urlQuotes: require('./value-optimizers/url-quotes').level1.value,
  urlWhiteSpace: require('./value-optimizers/url-whitespace').level1.value,
  whiteSpace: require('./value-optimizers/whitespace').level1.value,
  zero: require('./value-optimizers/zero').level1.value
};
