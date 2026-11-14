import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track identifiers that are source stream parts in various contexts
  const sourceStreamPartIdentifiers = new Set<string>();

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

  // Transform object literals that have nested source structure
  root
    .find(j.ObjectExpression)
    .filter(path => {
      // Look for objects with type: 'source' property and a 'source' property containing the nested data
      return (
        path.node.properties.some(prop => {
          return (
            (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'type' &&
            prop.value.type === 'StringLiteral' &&
            prop.value.value === 'source'
          );
        }) &&
        path.node.properties.some(prop => {
          return (
            (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'source' &&
            prop.value.type === 'ObjectExpression'
          );
        })
      );
    })
    .forEach(path => {
      const properties = path.node.properties;

      // Find the type property
      const typeProperty = properties.find(prop => {
        return (
          (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'type'
        );
      });

      // Find the source property with nested data
      const sourceProperty = properties.find(prop => {
        return (
          (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'source' &&
          prop.value.type === 'ObjectExpression'
        );
      });

      if (
        typeProperty &&
        sourceProperty &&
        (sourceProperty.type === 'ObjectProperty' ||
          sourceProperty.type === 'Property') &&
        sourceProperty.value.type === 'ObjectExpression'
      ) {
        // Extract all properties from the nested source object
        const nestedSourceProperties = sourceProperty.value.properties;

        // Create new flat properties array: type + all nested source properties
        const newProperties = [typeProperty, ...nestedSourceProperties];

        path.node.properties = newProperties;
        context.hasChanges = true;
      }
    });

  // Find source stream part identifiers from switch cases
  root
    .find(j.SwitchCase)
    .filter(path => {
      return !!(
        path.node.test &&
        path.node.test.type === 'StringLiteral' &&
        path.node.test.value === 'source'
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
        sourceStreamPartIdentifiers.add(identifierName);
      }
    });

  // Find source stream part identifiers from if statements
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
        test.right.value === 'source'
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
        sourceStreamPartIdentifiers.add(test.left.object.name);
      }
    });

  // Add fullStream iterator variables to sourceStreamPartIdentifiers
  fullStreamIteratorVariables.forEach(variable => {
    sourceStreamPartIdentifiers.add(variable);
  });

  // Find map callbacks where the parameter represents source stream parts
  // Look for patterns like: .filter(item => item.type === 'source').map(source => ...)
  root
    .find(j.CallExpression)
    .filter(path => {
      const callee = path.node.callee;
      if (callee.type !== 'MemberExpression') return false;
      if (
        callee.property.type !== 'Identifier' ||
        callee.property.name !== 'map'
      )
        return false;
      if (callee.object.type !== 'CallExpression') return false;

      const filterCall = callee.object;
      if (!filterCall.callee || filterCall.callee.type !== 'MemberExpression')
        return false;
      if (
        filterCall.callee.property.type !== 'Identifier' ||
        filterCall.callee.property.name !== 'filter'
      )
        return false;

      return true;
    })
    .forEach(path => {
      const callee = path.node.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'CallExpression'
      ) {
        const filterCall = callee.object;
        if (filterCall.arguments && filterCall.arguments[0]) {
          const filterCallback = filterCall.arguments[0];
          if (filterCallback.type === 'ArrowFunctionExpression') {
            const body = filterCallback.body;
            if (
              body.type === 'BinaryExpression' &&
              body.operator === '===' &&
              body.left.type === 'MemberExpression' &&
              body.left.property.type === 'Identifier' &&
              body.left.property.name === 'type' &&
              body.right.type === 'StringLiteral' &&
              body.right.value === 'source'
            ) {
              // Found filter for source types, now track the map callback parameter
              if (path.node.arguments && path.node.arguments[0]) {
                const mapCallback = path.node.arguments[0];
                if (
                  mapCallback.type === 'ArrowFunctionExpression' &&
                  mapCallback.params.length > 0 &&
                  mapCallback.params[0].type === 'Identifier'
                ) {
                  sourceStreamPartIdentifiers.add(mapCallback.params[0].name);
                }
              }
            }
          }
        }
      }
    });

  // Transform nested property access: part.source.sourceType -> part.sourceType
  root
    .find(j.MemberExpression)
    .filter(path => {
      return (
        path.node.object.type === 'MemberExpression' &&
        path.node.object.object.type === 'Identifier' &&
        sourceStreamPartIdentifiers.has(path.node.object.object.name) &&
        path.node.object.property.type === 'Identifier' &&
        path.node.object.property.name === 'source' &&
        path.node.property.type === 'Identifier' &&
        (path.node.property.name === 'sourceType' ||
          path.node.property.name === 'id' ||
          path.node.property.name === 'url' ||
          path.node.property.name === 'title' ||
          path.node.property.name === 'mediaType' ||
          path.node.property.name === 'filename' ||
          path.node.property.name === 'providerMetadata')
      );
    })
    .forEach(path => {
      // Transform part.source.sourceType to part.sourceType
      if (path.node.object.type === 'MemberExpression') {
        path.node.object = path.node.object.object;
        context.hasChanges = true;
      }
    });
});
