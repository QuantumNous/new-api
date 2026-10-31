import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace object property keys from providerMetadata to providerOptions
  root
    .find(j.ObjectProperty)
    .filter(path => {
      const key = path.node.key;
      return (
        (key.type === 'Identifier' && key.name === 'providerMetadata') ||
        (key.type === 'StringLiteral' && key.value === 'providerMetadata')
      );
    })
    .forEach(path => {
      const key = path.node.key;
      if (key.type === 'Identifier') {
        key.name = 'providerOptions';
      } else if (key.type === 'StringLiteral') {
        key.value = 'providerOptions';
      }
      context.hasChanges = true;
    });

  // Replace object method keys from providerMetadata to providerOptions
  root
    .find(j.ObjectMethod)
    .filter(path => {
      const key = path.node.key;
      return (
        (key.type === 'Identifier' && key.name === 'providerMetadata') ||
        (key.type === 'StringLiteral' && key.value === 'providerMetadata')
      );
    })
    .forEach(path => {
      const key = path.node.key;
      if (key.type === 'Identifier') {
        key.name = 'providerOptions';
      } else if (key.type === 'StringLiteral') {
        key.value = 'providerOptions';
      }
      context.hasChanges = true;
    });

  // Replace member expressions (e.g., params.providerMetadata)
  root
    .find(j.MemberExpression)
    .filter(path => {
      const property = path.node.property;
      return (
        (property.type === 'Identifier' &&
          property.name === 'providerMetadata') ||
        (property.type === 'StringLiteral' &&
          property.value === 'providerMetadata')
      );
    })
    .forEach(path => {
      const property = path.node.property;
      if (property.type === 'Identifier') {
        property.name = 'providerOptions';
      } else if (property.type === 'StringLiteral') {
        property.value = 'providerOptions';
      }
      context.hasChanges = true;
    });

  // Replace identifier references to providerMetadata variables
  root
    .find(j.Identifier)
    .filter(path => {
      // Only replace identifiers that are not part of object keys or member expressions
      // and are not in destructuring patterns (which are handled separately)
      const parent = path.parent;
      return (
        path.node.name === 'providerMetadata' &&
        parent.node.type !== 'ObjectProperty' &&
        parent.node.type !== 'ObjectMethod' &&
        parent.node.type !== 'MemberExpression' &&
        parent.node.type !== 'TSPropertySignature' &&
        !(parent.node.type === 'Property' && parent.node.key === path.node)
      );
    })
    .forEach(path => {
      path.node.name = 'providerOptions';
      context.hasChanges = true;
    });

  // Replace destructuring patterns in function parameters and variable declarations
  root.find(j.ObjectPattern).forEach(path => {
    path.node.properties.forEach(prop => {
      if (prop.type === 'ObjectProperty') {
        const key = prop.key;
        if (
          (key.type === 'Identifier' && key.name === 'providerMetadata') ||
          (key.type === 'StringLiteral' && key.value === 'providerMetadata')
        ) {
          if (key.type === 'Identifier') {
            key.name = 'providerOptions';
          } else if (key.type === 'StringLiteral') {
            key.value = 'providerOptions';
          }
          context.hasChanges = true;
        }
      } else if (prop.type === 'Property') {
        const key = prop.key;
        if (
          (key.type === 'Identifier' && key.name === 'providerMetadata') ||
          (key.type === 'StringLiteral' && key.value === 'providerMetadata')
        ) {
          if (key.type === 'Identifier') {
            key.name = 'providerOptions';
          } else if (key.type === 'StringLiteral') {
            key.value = 'providerOptions';
          }
          context.hasChanges = true;
        }
      }
    });
  });

  // Replace type annotations and interface properties
  root
    .find(j.TSPropertySignature)
    .filter(path => {
      const key = path.node.key;
      return (
        (key.type === 'Identifier' && key.name === 'providerMetadata') ||
        (key.type === 'StringLiteral' && key.value === 'providerMetadata')
      );
    })
    .forEach(path => {
      const key = path.node.key;
      if (key.type === 'Identifier') {
        key.name = 'providerOptions';
      } else if (key.type === 'StringLiteral') {
        key.value = 'providerOptions';
      }
      context.hasChanges = true;
    });
});
