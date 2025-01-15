var configuration = require('../../configuration');

function isComponentOf(property1, property2, shallow) {
  return isDirectComponentOf(property1, property2)
    || !shallow && !!configuration[property1.name].shorthandComponents && isSubComponentOf(property1, property2);
}

function isDirectComponentOf(property1, property2) {
  var descriptor = configuration[property1.name];

  return 'components' in descriptor && descriptor.components.indexOf(property2.name) > -1;
}

function isSubComponentOf(property1, property2) {
  return property1
    .components
    .some(function(component) {
      return isDirectComponentOf(component, property2);
    });
}

module.exports = isComponentOf;
