import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace member expressions: usage.promptTokens -> usage.inputTokens
  root
    .find(j.MemberExpression, {
      property: { name: 'promptTokens' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.property = j.identifier('inputTokens');
    });

  // Replace member expressions: usage.completionTokens -> usage.outputTokens
  root
    .find(j.MemberExpression, {
      property: { name: 'completionTokens' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.property = j.identifier('outputTokens');
    });

  // Replace object properties in object literals: { promptTokens: ... }
  root
    .find(j.ObjectProperty, {
      key: { name: 'promptTokens' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('inputTokens');
    });

  // Replace object properties in object literals: { completionTokens: ... }
  root
    .find(j.ObjectProperty, {
      key: { name: 'completionTokens' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('outputTokens');
    });

  // Replace Property nodes in object literals (alternative representation): { promptTokens: ... }
  root
    .find(j.Property, {
      key: { name: 'promptTokens' },
      shorthand: false,
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('inputTokens');
    });

  // Replace Property nodes in object literals (alternative representation): { completionTokens: ... }
  root
    .find(j.Property, {
      key: { name: 'completionTokens' },
      shorthand: false,
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('outputTokens');
    });

  // Replace shorthand object properties: { promptTokens } -> { inputTokens }
  root
    .find(j.Property, {
      key: { name: 'promptTokens' },
      shorthand: true,
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('inputTokens');
      path.node.value = j.identifier('inputTokens');
    });

  // Replace shorthand object properties: { completionTokens } -> { outputTokens }
  root
    .find(j.Property, {
      key: { name: 'completionTokens' },
      shorthand: true,
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('outputTokens');
      path.node.value = j.identifier('outputTokens');
    });

  // Replace destructuring patterns: { promptTokens } = obj
  root.find(j.ObjectPattern).forEach(path => {
    let hasPatternChanges = false;
    path.node.properties.forEach(prop => {
      // Handle both ObjectProperty and Property nodes in destructuring
      if (
        (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
        prop.key.type === 'Identifier'
      ) {
        if (prop.key.name === 'promptTokens') {
          prop.key = j.identifier('inputTokens');
          // If it's shorthand, update the value as well
          if (prop.shorthand && prop.value.type === 'Identifier') {
            prop.value = j.identifier('inputTokens');
          }
          hasPatternChanges = true;
        } else if (prop.key.name === 'completionTokens') {
          prop.key = j.identifier('outputTokens');
          // If it's shorthand, update the value as well
          if (prop.shorthand && prop.value.type === 'Identifier') {
            prop.value = j.identifier('outputTokens');
          }
          hasPatternChanges = true;
        }
      }
    });
    if (hasPatternChanges) {
      context.hasChanges = true;
    }
  });
});
