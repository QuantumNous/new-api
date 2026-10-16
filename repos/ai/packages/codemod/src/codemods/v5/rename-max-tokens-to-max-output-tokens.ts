import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find and replace object properties named 'maxTokens' with 'maxOutputTokens'
  root
    .find(j.ObjectProperty, {
      key: { name: 'maxTokens' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('maxOutputTokens');
    });

  // Find and replace Property nodes (alternative representation)
  root
    .find(j.Property, {
      key: { name: 'maxTokens' },
      shorthand: false,
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('maxOutputTokens');
    });

  // Find and replace shorthand object properties (e.g., { maxTokens })
  root
    .find(j.Property, {
      key: { name: 'maxTokens' },
      shorthand: true,
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('maxOutputTokens');
      path.node.value = j.identifier('maxOutputTokens');
    });

  // Replace member expressions (e.g., options.maxTokens)
  root
    .find(j.MemberExpression, {
      property: { name: 'maxTokens' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.property = j.identifier('maxOutputTokens');
    });

  // Replace destructuring patterns: { maxTokens } = obj
  root.find(j.ObjectPattern).forEach(path => {
    let hasPatternChanges = false;
    path.node.properties.forEach(prop => {
      // Handle both ObjectProperty and Property nodes in destructuring
      if (
        (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'maxTokens'
      ) {
        prop.key = j.identifier('maxOutputTokens');
        // If it's shorthand, update the value as well
        if (prop.shorthand && prop.value.type === 'Identifier') {
          prop.value = j.identifier('maxOutputTokens');
        }
        hasPatternChanges = true;
      }
    });
    if (hasPatternChanges) {
      context.hasChanges = true;
    }
  });

  // Replace TypeScript interface/type properties
  root
    .find(j.TSPropertySignature)
    .filter(path => {
      const key = path.node.key;
      return (
        (key.type === 'Identifier' && key.name === 'maxTokens') ||
        (key.type === 'StringLiteral' && key.value === 'maxTokens')
      );
    })
    .forEach(path => {
      const key = path.node.key;
      if (key.type === 'Identifier') {
        key.name = 'maxOutputTokens';
        context.hasChanges = true;
      } else if (key.type === 'StringLiteral') {
        key.value = 'maxOutputTokens';
        context.hasChanges = true;
      }
    });
});
