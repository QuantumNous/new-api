import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace method calls: result.toDataStreamResponse() -> result.toUIMessageStreamResponse()
  root
    .find(j.CallExpression)
    .filter(path => {
      return (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier' &&
        path.node.callee.property.name === 'toDataStreamResponse'
      );
    })
    .forEach(path => {
      if (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier'
      ) {
        path.node.callee.property.name = 'toUIMessageStreamResponse';

        function renameGetErrorMessage(objExpr: any) {
          if (!objExpr || !Array.isArray(objExpr.properties)) return;
          objExpr.properties.forEach((prop: any) => {
            if (
              prop.key &&
              ((prop.key.type === 'Identifier' &&
                prop.key.name === 'getErrorMessage') ||
                (prop.key.type === 'StringLiteral' &&
                  prop.key.value === 'getErrorMessage'))
            ) {
              if (prop.key.type === 'Identifier') {
                prop.key.name = 'onError';
              } else if (prop.key.type === 'StringLiteral') {
                prop.key.value = 'onError';
              }
              context.hasChanges = true;
            }
          });
        }

        const objArg = path.node.arguments[0];
        if (j.ObjectExpression.check(objArg)) {
          renameGetErrorMessage(objArg);
        } else if (j.Identifier.check(objArg)) {
          const varName = objArg.name;
          let found = false;
          root
            .find(j.VariableDeclarator, { id: { name: varName } })
            .forEach(varPath => {
              if (found) return;
              if (j.ObjectExpression.check(varPath.node.init)) {
                renameGetErrorMessage(varPath.node.init);
                found = true;
              }
            });
          if (!found) {
            root
              .find(j.AssignmentExpression, {
                left: { type: 'Identifier', name: varName },
              })
              .forEach(assignPath => {
                if (j.ObjectExpression.check(assignPath.node.right)) {
                  renameGetErrorMessage(assignPath.node.right);
                }
              });
          }
        }
        context.hasChanges = true;
      }
    });

  // Replace standalone function references (if they exist)
  root
    .find(j.Identifier)
    .filter(path => {
      // Only replace identifiers that are not property names in member expressions
      const parent = path.parent;
      return (
        path.node.name === 'toDataStreamResponse' &&
        parent.node.type !== 'ImportSpecifier' &&
        !(
          parent.node.type === 'MemberExpression' &&
          parent.node.property === path.node
        ) &&
        !(parent.node.type === 'Property' && parent.node.key === path.node) &&
        !(
          parent.node.type === 'ObjectProperty' && parent.node.key === path.node
        )
      );
    })
    .forEach(path => {
      path.node.name = 'toUIMessageStreamResponse';
      context.hasChanges = true;
    });
});
