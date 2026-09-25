import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track transformed nodes to avoid double transformation
  const transformedNodes = new WeakSet<object>();

  // Helper to check if inside a tool() call or looks like tool definition
  function isToolContext(path: any): boolean {
    // Check if inside a tool() call
    let parent = path.parent;
    while (parent) {
      if (
        parent.node &&
        parent.node.type === 'CallExpression' &&
        parent.node.callee?.type === 'Identifier' &&
        parent.node.callee.name === 'tool'
      ) {
        return true;
      }
      parent = parent.parent;
    }

    // Check if sibling properties suggest a tool definition
    const parentNode = path.parent?.node;
    if (parentNode && parentNode.type === 'ObjectExpression') {
      const siblingKeys = parentNode.properties
        .filter((p: any) => p.key?.type === 'Identifier')
        .map((p: any) => p.key.name);

      return (
        siblingKeys.includes('description') ||
        siblingKeys.includes('execute') ||
        siblingKeys.includes('inputSchema') ||
        siblingKeys.includes('parameters')
      );
    }

    return false;
  }

  // Helper function to rename identifiers in scope
  function renameIdentifiersInScope(
    body: any,
    oldName: string,
    newName: string,
  ) {
    j(body)
      .find(j.Identifier, { name: oldName })
      .filter((idPath: any) => {
        const parent = idPath.parent.node;

        // Don't rename property keys in object literals (unless computed)
        if (
          (parent.type === 'Property' || parent.type === 'ObjectProperty') &&
          parent.key === idPath.node &&
          !parent.computed
        ) {
          return false;
        }

        // Don't rename member expression properties (unless computed)
        if (
          parent.type === 'MemberExpression' &&
          parent.property === idPath.node &&
          !parent.computed
        ) {
          return false;
        }

        return true;
      })
      .forEach((idPath: any) => {
        idPath.node.name = newName;
      });
  }

  // Helper to transform function params (shared logic)
  function transformParams(params: any[], body: any, node: any) {
    if (params.length !== 1) return false;

    const firstParam = params[0];

    if (firstParam.type === 'Identifier') {
      const oldName = firstParam.name;

      // Create new object pattern: { output }
      const newParam = j.objectPattern([
        j.objectProperty.from({
          key: j.identifier('output'),
          value: j.identifier('output'),
          shorthand: true,
        }),
      ]);

      params[0] = newParam;

      if (oldName !== 'output') {
        renameIdentifiersInScope(body, oldName, 'output');
      }

      transformedNodes.add(node);
      context.hasChanges = true;
      return true;
    } else if (firstParam.type === 'ObjectPattern') {
      const newParam = j.objectPattern([
        j.objectProperty(j.identifier('output'), firstParam),
      ]);

      params[0] = newParam;
      transformedNodes.add(node);
      context.hasChanges = true;
      return true;
    }

    return false;
  }

  // Transform ObjectMethod (method shorthand: toModelOutput(result) { ... })
  root
    .find(j.ObjectMethod)
    .filter(path => {
      return (
        path.node.key.type === 'Identifier' &&
        path.node.key.name === 'toModelOutput' &&
        !transformedNodes.has(path.node)
      );
    })
    .forEach(path => {
      if (!isToolContext(path)) return;
      transformParams(path.node.params, path.node.body, path.node);
    });

  // Transform ObjectProperty (toModelOutput: output => ... or toModelOutput: function(result) { ... })
  root
    .find(j.ObjectProperty)
    .filter(path => {
      return (
        path.node.key.type === 'Identifier' &&
        path.node.key.name === 'toModelOutput' &&
        !transformedNodes.has(path.node)
      );
    })
    .forEach(path => {
      if (!isToolContext(path)) return;

      const value = path.node.value;
      if (
        value.type !== 'ArrowFunctionExpression' &&
        value.type !== 'FunctionExpression'
      ) {
        return;
      }

      transformParams(value.params, value.body, path.node);
    });

  // Handle Property nodes (alternative AST representation)
  root
    .find(j.Property)
    .filter(path => {
      return (
        path.node.key.type === 'Identifier' &&
        path.node.key.name === 'toModelOutput' &&
        !transformedNodes.has(path.node)
      );
    })
    .forEach(path => {
      if (!isToolContext(path)) return;

      const value = path.node.value;
      if (
        value.type !== 'ArrowFunctionExpression' &&
        value.type !== 'FunctionExpression'
      ) {
        return;
      }

      transformParams(value.params, value.body, path.node);
    });
});
