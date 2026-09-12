import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track variable names that were renamed from addToolResult to addToolOutput
  const renamedVariables = new Set<string>();

  // Replace member expressions (e.g., chat.addToolResult, options.addToolResult)
  root
    .find(j.MemberExpression, {
      property: { name: 'addToolOutput' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.property = j.identifier('addToolOutput');
    });

  // Replace destructured identifiers in object patterns
  root.find(j.ObjectPattern).forEach(path => {
    let hasPatternChanges = false;
    path.node.properties.forEach(prop => {
      // Handle both ObjectProperty and Property nodes in destructuring
      if (
        (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'addToolOutput'
      ) {
        prop.key = j.identifier('addToolOutput');
        // If it's shorthand, update the value as well
        if (prop.shorthand && prop.value.type === 'Identifier') {
          // Track the old name before renaming
          renamedVariables.add(prop.value.name);
          prop.value = j.identifier('addToolOutput');
        } else if (prop.value.type === 'Identifier') {
          // For non-shorthand like { addToolResult: localName }, track localName
          renamedVariables.add(prop.value.name);
        }
        hasPatternChanges = true;
      }
    });
    if (hasPatternChanges) {
      context.hasChanges = true;
    }
  });

  // Replace object property shorthand (e.g., { addToolResult })
  root
    .find(j.Property, {
      key: { name: 'addToolOutput' },
      shorthand: true,
    })
    .forEach(path => {
      context.hasChanges = true;
      if (path.node.value.type === 'Identifier') {
        renamedVariables.add(path.node.value.name);
      }
      path.node.key = j.identifier('addToolOutput');
      path.node.value = j.identifier('addToolOutput');
    });

  // Replace non-shorthand object properties (e.g., { addToolResult: func })
  root
    .find(j.ObjectProperty, {
      key: { name: 'addToolOutput' },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('addToolOutput');
    });

  // Replace non-shorthand Property nodes
  root
    .find(j.Property, {
      key: { name: 'addToolOutput' },
      shorthand: false,
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.key = j.identifier('addToolOutput');
    });

  // Replace all references to renamed variables
  if (renamedVariables.size > 0) {
    root
      .find(j.Identifier)
      .filter(path => {
        return (
          renamedVariables.has(path.node.name) &&
          // Don't modify the variable declaration itself
          !(
            path.parent.node.type === 'Property' &&
            path.parent.node.value === path.node
          ) &&
          !(
            path.parent.node.type === 'ObjectProperty' &&
            path.parent.node.value === path.node
          )
        );
      })
      .forEach(path => {
        context.hasChanges = true;
        if (path.node.name === 'addToolOutput') {
          path.node.name = 'addToolOutput';
        }
      });
  }

  // Replace TypeScript interface/type properties
  root
    .find(j.TSPropertySignature)
    .filter(path => {
      const key = path.node.key;
      return (
        (key.type === 'Identifier' && key.name === 'addToolOutput') ||
        (key.type === 'StringLiteral' && key.value === 'addToolOutput')
      );
    })
    .forEach(path => {
      const key = path.node.key;
      if (key.type === 'Identifier') {
        key.name = 'addToolOutput';
        context.hasChanges = true;
      } else if (key.type === 'StringLiteral') {
        key.value = 'addToolOutput';
        context.hasChanges = true;
      }
    });

  // Replace string literals in type unions (e.g., Pick<any, 'addToolResult' | 'sendMessage'>)
  root.find(j.StringLiteral).forEach(path => {
    if (path.node.value === 'addToolOutput') {
      path.node.value = 'addToolOutput';
      context.hasChanges = true;
    }
  });
});
