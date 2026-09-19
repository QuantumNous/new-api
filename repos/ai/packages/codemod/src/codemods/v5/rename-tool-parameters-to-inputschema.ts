import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find tool() function calls and rename parameters to inputSchema
  root
    .find(j.CallExpression)
    .filter(path => {
      return (
        path.node.callee.type === 'Identifier' &&
        path.node.callee.name === 'tool' &&
        path.node.arguments.length > 0 &&
        path.node.arguments[0].type === 'ObjectExpression'
      );
    })
    .forEach(path => {
      const firstArg = path.node.arguments[0];
      if (firstArg.type === 'ObjectExpression') {
        firstArg.properties.forEach(prop => {
          if (
            (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'parameters'
          ) {
            prop.key.name = 'inputSchema';
            context.hasChanges = true;
          }
        });
      }
    });

  // Also handle object properties in tool definitions within tool objects
  root
    .find(j.ObjectProperty)
    .filter(path => {
      // Look for tool definitions in objects like { weatherTool: { parameters: ... } }
      return (
        path.node.key.type === 'Identifier' &&
        path.node.key.name === 'parameters' &&
        path.node.value.type !== 'FunctionExpression' && // Not a function parameter
        path.node.value.type !== 'ArrowFunctionExpression' // Not arrow function parameter
      );
    })
    .forEach(path => {
      // Check if this looks like it's inside a tool definition
      // We look for sibling properties that suggest this is a tool
      const parent = path.parent;
      if (parent && parent.node.type === 'ObjectExpression') {
        const siblingKeys = parent.node.properties
          .filter(
            (prop: any) =>
              (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
              prop.key.type === 'Identifier',
          )
          .map((prop: any) => prop.key.name);

        // If we find typical tool properties, assume this is a tool definition
        if (
          siblingKeys.includes('description') ||
          siblingKeys.includes('execute')
        ) {
          if (path.node.key.type === 'Identifier') {
            path.node.key.name = 'inputSchema';
            context.hasChanges = true;
          }
        }
      }
    });

  // Handle Property nodes (alternative AST representation)
  root
    .find(j.Property)
    .filter(path => {
      return (
        path.node.key.type === 'Identifier' &&
        path.node.key.name === 'parameters' &&
        path.node.value.type !== 'FunctionExpression' &&
        path.node.value.type !== 'ArrowFunctionExpression'
      );
    })
    .forEach(path => {
      // Check if this looks like it's inside a tool definition
      const parent = path.parent;
      if (parent && parent.node.type === 'ObjectExpression') {
        const siblingKeys = parent.node.properties
          .filter(
            (prop: any) =>
              (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
              prop.key.type === 'Identifier',
          )
          .map((prop: any) => prop.key.name);

        if (
          siblingKeys.includes('description') ||
          siblingKeys.includes('execute')
        ) {
          if (path.node.key.type === 'Identifier') {
            path.node.key.name = 'inputSchema';
            context.hasChanges = true;
          }
        }
      }
    });
});
