var everyValuesPair = require('./every-values-pair');
var hasInherit = require('./has-inherit');
var hasSameValues = require('./has-same-values');
var populateComponents = require('./populate-components');

var configuration = require('../../configuration');
var deepClone = require('../../clone').deep;
var restoreWithComponents = require('../restore-with-components');

var restoreFromOptimizing = require('../../restore-from-optimizing');
var wrapSingle = require('../../wrap-for-optimizing').single;

var serializeBody = require('../../../writer/one-time').body;
var Token = require('../../../tokenizer/token');

function mergeIntoShorthands(properties, validator) {
  var candidates = {};
  var descriptor;
  var componentOf;
  var property;
  var i, l;
  var j, m;

  // there is no shorthand property made up of less than 3 longhands
  if (properties.length < 3) {
    return;
  }

  for (i = 0, l = properties.length; i < l; i++) {
    property = properties[i];
    descriptor = configuration[property.name];

    if (property.dynamic) {
      continue;
    }

    if (property.unused) {
      continue;
    }

    if (property.hack) {
      continue;
    }

    if (property.block) {
      continue;
    }

    if (descriptor && descriptor.singleTypeComponents && !hasSameValues(property)) {
      continue;
    }

    invalidateOrCompact(properties, i, candidates, validator);

    if (descriptor && descriptor.componentOf) {
      for (j = 0, m = descriptor.componentOf.length; j < m; j++) {
        componentOf = descriptor.componentOf[j];

        candidates[componentOf] = candidates[componentOf] || {};
        candidates[componentOf][property.name] = property;
      }
    }
  }

  invalidateOrCompact(properties, i, candidates, validator);
}

function invalidateOrCompact(properties, position, candidates, validator) {
  var invalidatedBy = properties[position];
  var shorthandName;
  var shorthandDescriptor;
  var candidateComponents;
  var replacedCandidates = [];
  var i;

  for (shorthandName in candidates) {
    if (undefined !== invalidatedBy && shorthandName == invalidatedBy.name) {
      continue;
    }

    shorthandDescriptor = configuration[shorthandName];
    candidateComponents = candidates[shorthandName];
    if (invalidatedBy && invalidates(candidates, shorthandName, invalidatedBy)) {
      delete candidates[shorthandName];
      continue;
    }

    if (shorthandDescriptor.components.length > Object.keys(candidateComponents).length) {
      continue;
    }

    if (mixedImportance(candidateComponents)) {
      continue;
    }

    if (!overridable(candidateComponents, shorthandName, validator)) {
      continue;
    }

    if (!mergeable(candidateComponents)) {
      continue;
    }

    if (mixedInherit(candidateComponents)) {
      replaceWithInheritBestFit(properties, candidateComponents, shorthandName, validator);
    } else {
      replaceWithShorthand(properties, candidateComponents, shorthandName, validator);
    }

    replacedCandidates.push(shorthandName);
  }

  for (i = replacedCandidates.length - 1; i >= 0; i--) {
    delete candidates[replacedCandidates[i]];
  }
}

function invalidates(candidates, shorthandName, invalidatedBy) {
  var shorthandDescriptor = configuration[shorthandName];
  var invalidatedByDescriptor = configuration[invalidatedBy.name];
  var componentName;

  if ('overridesShorthands' in shorthandDescriptor && shorthandDescriptor.overridesShorthands.indexOf(invalidatedBy.name) > -1) {
    return true;
  }

  if (invalidatedByDescriptor && 'componentOf' in invalidatedByDescriptor) {
    for (componentName in candidates[shorthandName]) {
      if (invalidatedByDescriptor.componentOf.indexOf(componentName) > -1) {
        return true;
      }
    }
  }

  return false;
}

function mixedImportance(components) {
  var important;
  var componentName;

  for (componentName in components) {
    if (undefined !== important && components[componentName].important != important) {
      return true;
    }

    important = components[componentName].important;
  }

  return false;
}

function overridable(components, shorthandName, validator) {
  var descriptor = configuration[shorthandName];
  var newValuePlaceholder = [
    Token.PROPERTY,
    [Token.PROPERTY_NAME, shorthandName],
    [Token.PROPERTY_VALUE, descriptor.defaultValue]
  ];
  var newProperty = wrapSingle(newValuePlaceholder);
  var component;
  var mayOverride;
  var i, l;

  populateComponents([newProperty], validator, []);

  for (i = 0, l = descriptor.components.length; i < l; i++) {
    component = components[descriptor.components[i]];
    mayOverride = configuration[component.name].canOverride || sameValue;

    if (!everyValuesPair(mayOverride.bind(null, validator), newProperty.components[i], component)) {
      return false;
    }
  }

  return true;
}

function sameValue(_validator, value1, value2) {
  return value1 === value2;
}

function mergeable(components) {
  var lastCount = null;
  var currentCount;
  var componentName;
  var component;
  var descriptor;
  var values;

  for (componentName in components) {
    component = components[componentName];
    descriptor = configuration[componentName];

    if (!('restore' in descriptor)) {
      continue;
    }

    restoreFromOptimizing([component.all[component.position]], restoreWithComponents);
    values = descriptor.restore(component, configuration);

    currentCount = values.length;

    if (lastCount !== null && currentCount !== lastCount) {
      return false;
    }

    lastCount = currentCount;
  }

  return true;
}

function mixedInherit(components) {
  var componentName;
  var lastValue = null;
  var currentValue;

  for (componentName in components) {
    currentValue = hasInherit(components[componentName]);

    if (lastValue !== null && lastValue !== currentValue) {
      return true;
    }

    lastValue = currentValue;
  }

  return false;
}

function replaceWithInheritBestFit(properties, candidateComponents, shorthandName, validator) {
  var viaLonghands = buildSequenceWithInheritLonghands(candidateComponents, shorthandName, validator);
  var viaShorthand = buildSequenceWithInheritShorthand(candidateComponents, shorthandName, validator);
  var longhandTokensSequence = viaLonghands[0];
  var shorthandTokensSequence = viaShorthand[0];
  var isLonghandsShorter = serializeBody(longhandTokensSequence).length < serializeBody(shorthandTokensSequence).length;
  var newTokensSequence = isLonghandsShorter ? longhandTokensSequence : shorthandTokensSequence;
  var newProperty = isLonghandsShorter ? viaLonghands[1] : viaShorthand[1];
  var newComponents = isLonghandsShorter ? viaLonghands[2] : viaShorthand[2];
  var lastComponent = candidateComponents[Object.keys(candidateComponents).pop()];
  var all = lastComponent.all;
  var insertAt = lastComponent.position;
  var componentName;
  var oldComponent;
  var newComponent;
  var newToken;

  newProperty.position = insertAt;
  newProperty.shorthand = true;
  newProperty.important = lastComponent.important;
  newProperty.multiplex = false;
  newProperty.dirty = true;
  newProperty.all = all;
  newProperty.all[insertAt] = newTokensSequence[0];

  properties.splice(insertAt, 1, newProperty);

  for (componentName in candidateComponents) {
    oldComponent = candidateComponents[componentName];
    oldComponent.unused = true;

    newProperty.multiplex = newProperty.multiplex || oldComponent.multiplex;

    if (oldComponent.name in newComponents) {
      newComponent = newComponents[oldComponent.name];
      newToken = findTokenIn(newTokensSequence, componentName);

      newComponent.position = all.length;
      newComponent.all = all;
      newComponent.all.push(newToken);

      properties.push(newComponent);
    }
  }
}

function buildSequenceWithInheritLonghands(components, shorthandName, validator) {
  var tokensSequence = [];
  var inheritComponents = {};
  var nonInheritComponents = {};
  var descriptor = configuration[shorthandName];
  var shorthandToken = [
    Token.PROPERTY,
    [Token.PROPERTY_NAME, shorthandName],
    [Token.PROPERTY_VALUE, descriptor.defaultValue]
  ];
  var newProperty = wrapSingle(shorthandToken);
  var component;
  var longhandToken;
  var newComponent;
  var nameMetadata;
  var i, l;

  populateComponents([newProperty], validator, []);

  for (i = 0, l = descriptor.components.length; i < l; i++) {
    component = components[descriptor.components[i]];

    if (hasInherit(component)) {
      longhandToken = component.all[component.position].slice(0, 2);
      Array.prototype.push.apply(longhandToken, component.value);
      tokensSequence.push(longhandToken);

      newComponent = deepClone(component);
      newComponent.value = inferComponentValue(components, newComponent.name);

      newProperty.components[i] = newComponent;
      inheritComponents[component.name] = deepClone(component);
    } else {
      newComponent = deepClone(component);
      newComponent.all = component.all;
      newProperty.components[i] = newComponent;

      nonInheritComponents[component.name] = component;
    }
  }

  newProperty.important = components[Object.keys(components).pop()].important;

  nameMetadata = joinMetadata(nonInheritComponents, 1);
  shorthandToken[1].push(nameMetadata);

  restoreFromOptimizing([newProperty], restoreWithComponents);

  shorthandToken = shorthandToken.slice(0, 2);
  Array.prototype.push.apply(shorthandToken, newProperty.value);

  tokensSequence.unshift(shorthandToken);

  return [tokensSequence, newProperty, inheritComponents];
}

function inferComponentValue(components, propertyName) {
  var descriptor = configuration[propertyName];

  if ('oppositeTo' in descriptor) {
    return components[descriptor.oppositeTo].value;
  }
  return [[Token.PROPERTY_VALUE, descriptor.defaultValue]];
}

function joinMetadata(components, at) {
  var metadata = [];
  var component;
  var originalValue;
  var componentMetadata;
  var componentName;

  for (componentName in components) {
    component = components[componentName];
    originalValue = component.all[component.position];
    componentMetadata = originalValue[at][originalValue[at].length - 1];

    Array.prototype.push.apply(metadata, componentMetadata);
  }

  return metadata.sort(metadataSorter);
}

function metadataSorter(metadata1, metadata2) {
  var line1 = metadata1[0];
  var line2 = metadata2[0];
  var column1 = metadata1[1];
  var column2 = metadata2[1];

  if (line1 < line2) {
    return -1;
  } if (line1 === line2) {
    return column1 < column2 ? -1 : 1;
  }
  return 1;
}

function buildSequenceWithInheritShorthand(components, shorthandName, validator) {
  var tokensSequence = [];
  var inheritComponents = {};
  var nonInheritComponents = {};
  var descriptor = configuration[shorthandName];
  var shorthandToken = [
    Token.PROPERTY,
    [Token.PROPERTY_NAME, shorthandName],
    [Token.PROPERTY_VALUE, 'inherit']
  ];
  var newProperty = wrapSingle(shorthandToken);
  var component;
  var longhandToken;
  var nameMetadata;
  var valueMetadata;
  var i, l;

  populateComponents([newProperty], validator, []);

  for (i = 0, l = descriptor.components.length; i < l; i++) {
    component = components[descriptor.components[i]];

    if (hasInherit(component)) {
      inheritComponents[component.name] = component;
    } else {
      longhandToken = component.all[component.position].slice(0, 2);
      Array.prototype.push.apply(longhandToken, component.value);
      tokensSequence.push(longhandToken);

      nonInheritComponents[component.name] = deepClone(component);
    }
  }

  nameMetadata = joinMetadata(inheritComponents, 1);
  shorthandToken[1].push(nameMetadata);

  valueMetadata = joinMetadata(inheritComponents, 2);
  shorthandToken[2].push(valueMetadata);

  tokensSequence.unshift(shorthandToken);

  return [tokensSequence, newProperty, nonInheritComponents];
}

function findTokenIn(tokens, componentName) {
  var i, l;

  for (i = 0, l = tokens.length; i < l; i++) {
    if (tokens[i][1][1] == componentName) {
      return tokens[i];
    }
  }
}

function replaceWithShorthand(properties, candidateComponents, shorthandName, validator) {
  var descriptor = configuration[shorthandName];
  var nameMetadata;
  var valueMetadata;
  var newValuePlaceholder = [
    Token.PROPERTY,
    [Token.PROPERTY_NAME, shorthandName],
    [Token.PROPERTY_VALUE, descriptor.defaultValue]
  ];
  var all;
  var insertAt = inferInsertAtFrom(properties, candidateComponents, shorthandName);

  var newProperty = wrapSingle(newValuePlaceholder);
  newProperty.shorthand = true;
  newProperty.dirty = true;
  newProperty.multiplex = false;

  populateComponents([newProperty], validator, []);

  for (var i = 0, l = descriptor.components.length; i < l; i++) {
    var component = candidateComponents[descriptor.components[i]];

    newProperty.components[i] = deepClone(component);
    newProperty.important = component.important;
    newProperty.multiplex = newProperty.multiplex || component.multiplex;

    all = component.all;
  }

  for (var componentName in candidateComponents) {
    candidateComponents[componentName].unused = true;
  }

  nameMetadata = joinMetadata(candidateComponents, 1);
  newValuePlaceholder[1].push(nameMetadata);

  valueMetadata = joinMetadata(candidateComponents, 2);
  newValuePlaceholder[2].push(valueMetadata);

  newProperty.position = insertAt;
  newProperty.all = all;
  newProperty.all[insertAt] = newValuePlaceholder;

  properties.splice(insertAt, 1, newProperty);
}

function inferInsertAtFrom(properties, candidateComponents, shorthandName) {
  var candidateComponentNames = Object.keys(candidateComponents);
  var firstCandidatePosition = candidateComponents[candidateComponentNames[0]].position;
  var lastCandidatePosition = candidateComponents[candidateComponentNames[candidateComponentNames.length - 1]].position;

  if (shorthandName == 'border' && traversesVia(properties.slice(firstCandidatePosition, lastCandidatePosition), 'border-image')) {
    return firstCandidatePosition;
  }
  return lastCandidatePosition;
}

function traversesVia(properties, propertyName) {
  for (var i = properties.length - 1; i >= 0; i--) {
    if (properties[i].name == propertyName) {
      return true;
    }
  }

  return false;
}

module.exports = mergeIntoShorthands;
