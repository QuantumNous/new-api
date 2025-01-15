var configuration = require('../../configuration');

function overridesNonComponentShorthand(property1, property2) {
  return property1.name in configuration
    && 'overridesShorthands' in configuration[property1.name]
    && configuration[property1.name].overridesShorthands.indexOf(property2.name) > -1;
}

module.exports = overridesNonComponentShorthand;
