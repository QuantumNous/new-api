import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace member expressions (e.g., result.reasoning -> result.reasoningText)
  root
    .find(j.MemberExpression)
    .filter(path => {
      const property = path.node.property;
      return (
        property.type === 'Identifier' &&
        (property.name === 'reasoning' || property.name === 'reasoningDetails')
      );
    })
    .forEach(path => {
      const property = path.node.property;
      if (property.type === 'Identifier') {
        if (property.name === 'reasoning') {
          property.name = 'reasoningText';
          context.hasChanges = true;
        } else if (property.name === 'reasoningDetails') {
          property.name = 'reasoning';
          context.hasChanges = true;
        }
      }
    });

  // Replace string literal property access (e.g., result['reasoning'])
  root
    .find(j.MemberExpression)
    .filter(path => {
      const property = path.node.property;
      return (
        property.type === 'StringLiteral' &&
        (property.value === 'reasoning' ||
          property.value === 'reasoningDetails')
      );
    })
    .forEach(path => {
      const property = path.node.property;
      if (property.type === 'StringLiteral') {
        if (property.value === 'reasoning') {
          property.value = 'reasoningText';
          context.hasChanges = true;
        } else if (property.value === 'reasoningDetails') {
          property.value = 'reasoning';
          context.hasChanges = true;
        }
      }
    });

  // Replace object property keys in object literals
  root
    .find(j.ObjectProperty)
    .filter(path => {
      const key = path.node.key;
      return (
        (key.type === 'Identifier' &&
          (key.name === 'reasoning' || key.name === 'reasoningDetails')) ||
        (key.type === 'StringLiteral' &&
          (key.value === 'reasoning' || key.value === 'reasoningDetails'))
      );
    })
    .forEach(path => {
      const key = path.node.key;
      if (key.type === 'Identifier') {
        if (key.name === 'reasoning') {
          key.name = 'reasoningText';
          context.hasChanges = true;
        } else if (key.name === 'reasoningDetails') {
          key.name = 'reasoning';
          context.hasChanges = true;
        }
      } else if (key.type === 'StringLiteral') {
        if (key.value === 'reasoning') {
          key.value = 'reasoningText';
          context.hasChanges = true;
        } else if (key.value === 'reasoningDetails') {
          key.value = 'reasoning';
          context.hasChanges = true;
        }
      }
    });

  // Replace destructuring patterns in variable declarations and function parameters
  root.find(j.ObjectPattern).forEach(path => {
    path.node.properties.forEach(prop => {
      if (prop.type === 'ObjectProperty' || prop.type === 'Property') {
        const key = prop.key;
        if (key.type === 'Identifier') {
          if (key.name === 'reasoning') {
            // If it's shorthand, convert to explicit renaming
            if (prop.shorthand) {
              prop.shorthand = false;
              prop.value = j.identifier('reasoning');
            }
            key.name = 'reasoningText';
            context.hasChanges = true;
          } else if (key.name === 'reasoningDetails') {
            // If it's shorthand, convert to explicit renaming
            if (prop.shorthand) {
              prop.shorthand = false;
              prop.value = j.identifier('reasoningDetails');
            }
            key.name = 'reasoning';
            context.hasChanges = true;
          }
        }
      }
    });
  });

  // Replace TypeScript interface/type properties
  root
    .find(j.TSPropertySignature)
    .filter(path => {
      const key = path.node.key;
      return (
        (key.type === 'Identifier' &&
          (key.name === 'reasoning' || key.name === 'reasoningDetails')) ||
        (key.type === 'StringLiteral' &&
          (key.value === 'reasoning' || key.value === 'reasoningDetails'))
      );
    })
    .forEach(path => {
      const key = path.node.key;
      if (key.type === 'Identifier') {
        if (key.name === 'reasoning') {
          key.name = 'reasoningText';
          context.hasChanges = true;
        } else if (key.name === 'reasoningDetails') {
          key.name = 'reasoning';
          context.hasChanges = true;
        }
      } else if (key.type === 'StringLiteral') {
        if (key.value === 'reasoning') {
          key.value = 'reasoningText';
          context.hasChanges = true;
        } else if (key.value === 'reasoningDetails') {
          key.value = 'reasoning';
          context.hasChanges = true;
        }
      }
    });
});
