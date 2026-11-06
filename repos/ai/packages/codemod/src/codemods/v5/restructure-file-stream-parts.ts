import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track identifiers that are file stream parts in various contexts
  const fileStreamPartIdentifiers = new Set<string>();

  // Track variables that hold streamText results
  const streamTextResultVariables = new Set<string>();

  // Track iterator variables from result.fullStream
  const fullStreamIteratorVariables = new Set<string>();

  // Find streamText imports and track result variables
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      return (
        path.node.source.type === 'StringLiteral' &&
        path.node.source.value === 'ai'
      );
    })
    .forEach(path => {
      if (path.node.specifiers) {
        path.node.specifiers.forEach(specifier => {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'streamText'
          ) {
            // Find streamText calls and track their result variables
            root
              .find(j.CallExpression)
              .filter(callPath => {
                return (
                  callPath.node.callee.type === 'Identifier' &&
                  callPath.node.callee.name === 'streamText'
                );
              })
              .forEach(callPath => {
                // Look for variable declarations that store the result
                const parent = callPath.parent;
                if (
                  parent &&
                  parent.value &&
                  parent.value.type === 'VariableDeclarator' &&
                  parent.value.id.type === 'Identifier'
                ) {
                  streamTextResultVariables.add(parent.value.id.name);
                }
              });
          }
        });
      }
    });

  // Find for-await-of loops over result.fullStream
  root.find(j.ForAwaitStatement).forEach(path => {
    const right = path.node.right;
    if (
      right &&
      right.type === 'MemberExpression' &&
      right.object.type === 'Identifier' &&
      streamTextResultVariables.has(right.object.name) &&
      right.property.type === 'Identifier' &&
      right.property.name === 'fullStream'
    ) {
      // Track the iterator variable
      const left = path.node.left;
      if (left.type === 'VariableDeclaration' && left.declarations[0]) {
        const declaration = left.declarations[0];
        if (
          declaration.type === 'VariableDeclarator' &&
          declaration.id.type === 'Identifier'
        ) {
          fullStreamIteratorVariables.add(declaration.id.name);
        }
      }
    }
  });

  // Transform object literals that represent file stream parts
  // (not file objects in message content)
  root
    .find(j.ObjectExpression)
    .filter(path => {
      // Must have type: 'file' property
      const hasFileType = path.node.properties.some(prop => {
        if (
          (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'type' &&
          prop.value.type === 'StringLiteral' &&
          prop.value.value === 'file'
        ) {
          return true;
        }
        return false;
      });

      if (!hasFileType) {
        return false;
      }

      // Must have at least one file stream part specific property
      // Only transform objects that have stream-specific properties like base64 or uint8Array
      // This excludes message content files which typically only have mediaType + data
      const fileStreamProperties = ['base64', 'uint8Array', 'mimeType'];

      const hasStreamProperty = path.node.properties.some(prop => {
        if (
          (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
          prop.key.type === 'Identifier'
        ) {
          return fileStreamProperties.includes(prop.key.name);
        }
        return false;
      });

      // Only transform if it has file stream-specific properties
      return hasStreamProperty;
    })
    .forEach(path => {
      const properties = path.node.properties;

      // Find file-related properties (everything except 'type')
      const fileProperties = properties.filter(prop => {
        if (
          (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
          prop.key.type === 'Identifier'
        ) {
          return prop.key.name !== 'type';
        }
        return false;
      });

      // Only transform if we have file properties to move
      if (fileProperties.length > 0) {
        // Transform mimeType to mediaType in the file properties
        fileProperties.forEach(prop => {
          if (
            (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'mimeType'
          ) {
            prop.key.name = 'mediaType';
          }
        });

        // Create new file object with the file properties
        const fileObject = j.objectExpression(fileProperties);

        // Create new properties array with just type and file
        const typeProperty = properties.find(prop => {
          return (
            (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'type'
          );
        });

        if (typeProperty) {
          const newProperties = [
            typeProperty,
            j.objectProperty(j.identifier('file'), fileObject),
          ];

          path.node.properties = newProperties;
          context.hasChanges = true;
        }
      }
    });

  // Find file stream part identifiers from switch cases
  root
    .find(j.SwitchCase)
    .filter(path => {
      return !!(
        path.node.test &&
        path.node.test.type === 'StringLiteral' &&
        path.node.test.value === 'file'
      );
    })
    .forEach(path => {
      // Look for the switch expression to find the identifier
      const switchStatement = path.parent;
      if (
        switchStatement &&
        switchStatement.value &&
        switchStatement.value.type === 'SwitchStatement' &&
        switchStatement.value.discriminant.type === 'MemberExpression' &&
        switchStatement.value.discriminant.property.type === 'Identifier' &&
        switchStatement.value.discriminant.property.name === 'type' &&
        switchStatement.value.discriminant.object.type === 'Identifier'
      ) {
        const identifierName = switchStatement.value.discriminant.object.name;
        fileStreamPartIdentifiers.add(identifierName);

        // Also check if this identifier is a fullStream iterator
        if (fullStreamIteratorVariables.has(identifierName)) {
          fileStreamPartIdentifiers.add(identifierName);
        }
      }
    });

  // Find file stream part identifiers from if statements
  root
    .find(j.IfStatement)
    .filter(path => {
      const test = path.node.test;
      return (
        test &&
        test.type === 'BinaryExpression' &&
        test.operator === '===' &&
        test.left.type === 'MemberExpression' &&
        test.left.property.type === 'Identifier' &&
        test.left.property.name === 'type' &&
        test.right.type === 'StringLiteral' &&
        test.right.value === 'file'
      );
    })
    .forEach(path => {
      const test = path.node.test;
      if (
        test &&
        test.type === 'BinaryExpression' &&
        test.left.type === 'MemberExpression' &&
        test.left.object.type === 'Identifier'
      ) {
        fileStreamPartIdentifiers.add(test.left.object.name);
      }
    });

  // Add fullStream iterator variables to fileStreamPartIdentifiers
  fullStreamIteratorVariables.forEach(variable => {
    fileStreamPartIdentifiers.add(variable);
  });

  // Transform property access on identified file stream part variables
  root
    .find(j.MemberExpression)
    .filter(path => {
      return (
        path.node.object.type === 'Identifier' &&
        fileStreamPartIdentifiers.has(path.node.object.name) &&
        path.node.property.type === 'Identifier' &&
        (path.node.property.name === 'mediaType' ||
          path.node.property.name === 'mimeType' ||
          path.node.property.name === 'data' ||
          path.node.property.name === 'base64' ||
          path.node.property.name === 'uint8Array')
      );
    })
    .forEach(path => {
      // Transform part.mediaType to part.file.mediaType
      // Also rename mimeType to mediaType
      if (
        path.node.property.type === 'Identifier' &&
        path.node.property.name === 'mimeType'
      ) {
        path.node.property.name = 'mediaType';
      }

      path.node.object = j.memberExpression(
        path.node.object,
        j.identifier('file'),
      );
      context.hasChanges = true;
    });

  // Transform direct identifier references that should become part.file
  // This handles cases like presentImages([part]) in file contexts
  root
    .find(j.Identifier)
    .filter(path => {
      return (
        fileStreamPartIdentifiers.has(path.node.name) &&
        // Make sure this is not a property key or already part of a member expression
        path.parent.value.type !== 'MemberExpression' &&
        path.parent.value.type !== 'Property' &&
        path.parent.value.type !== 'ObjectProperty'
      );
    })
    .forEach(path => {
      // Check if this identifier is in a context where we're dealing with the file object
      // We need to look for the switch case or if statement context
      let isInFileContext = false;
      let currentParent = path.parent;

      while (currentParent && !isInFileContext) {
        if (
          currentParent.value &&
          currentParent.value.type === 'SwitchCase' &&
          currentParent.value.test &&
          currentParent.value.test.type === 'StringLiteral' &&
          currentParent.value.test.value === 'file'
        ) {
          isInFileContext = true;
          break;
        }
        currentParent = currentParent.parent;
      }

      // Also check for if statement context
      if (!isInFileContext) {
        currentParent = path.parent;
        while (currentParent && !isInFileContext) {
          if (
            currentParent.value &&
            currentParent.value.type === 'IfStatement' &&
            currentParent.value.test &&
            currentParent.value.test.type === 'BinaryExpression' &&
            currentParent.value.test.operator === '===' &&
            currentParent.value.test.right &&
            currentParent.value.test.right.type === 'StringLiteral' &&
            currentParent.value.test.right.value === 'file'
          ) {
            isInFileContext = true;
            break;
          }
          currentParent = currentParent.parent;
        }
      }

      if (isInFileContext) {
        // Transform part to part.file
        j(path).replaceWith(
          j.memberExpression(
            j.identifier(path.node.name),
            j.identifier('file'),
          ),
        );
        context.hasChanges = true;
      }
    });
});
