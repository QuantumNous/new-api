var configuration = require('../../configuration');
var InvalidPropertyError = require('../../invalid-property-error');

function populateComponents(properties, validator, warnings) {
  var component;
  var j, m;

  for (var i = properties.length - 1; i >= 0; i--) {
    var property = properties[i];
    var descriptor = configuration[property.name];

    if (!property.dynamic && descriptor && descriptor.shorthand) {
      if (onlyValueIsVariable(property, validator) || moreThanOneValueIsVariable(property, validator)) {
        property.optimizable = false;
        continue;
      }

      property.shorthand = true;
      property.dirty = true;

      try {
        property.components = descriptor.breakUp(property, configuration, validator);

        if (descriptor.shorthandComponents) {
          for (j = 0, m = property.components.length; j < m; j++) {
            component = property.components[j];
            component.components = configuration[component.name].breakUp(component, configuration, validator);
          }
        }
      } catch (e) {
        if (e instanceof InvalidPropertyError) {
          property.components = []; // this will set property.unused to true below
          warnings.push(e.message);
        } else {
          throw e;
        }
      }

      if (property.components.length > 0) {
        property.multiplex = property.components[0].multiplex;
      } else {
        property.unused = true;
      }
    }
  }
}

function onlyValueIsVariable(property, validator) {
  return property.value.length == 1 && validator.isVariable(property.value[0][1]);
}

function moreThanOneValueIsVariable(property, validator) {
  return property.value.length > 1
    && property.value.filter(
      function(value) {
        return validator.isVariable(value[1]);
      }
    ).length > 1;
}

module.exports = populateComponents;
