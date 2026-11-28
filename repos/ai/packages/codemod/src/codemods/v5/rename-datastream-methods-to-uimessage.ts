import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace method calls: result.toDataStream() -> result.toUIMessageStream()
  root
    .find(j.CallExpression)
    .filter(path => {
      return (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier' &&
        path.node.callee.property.name === 'toDataStream'
      );
    })
    .forEach(path => {
      if (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier'
      ) {
        path.node.callee.property.name = 'toUIMessageStream';
        context.hasChanges = true;
      }
    });

  // Replace method calls: result.mergeIntoDataStream() -> result.mergeIntoUIMessageStream()
  root
    .find(j.CallExpression)
    .filter(path => {
      return (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier' &&
        path.node.callee.property.name === 'mergeIntoDataStream'
      );
    })
    .forEach(path => {
      if (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier'
      ) {
        path.node.callee.property.name = 'mergeIntoUIMessageStream';
        context.hasChanges = true;
      }
    });

  // Replace member expressions when used as values (e.g., const method = result.toDataStream)
  root
    .find(j.MemberExpression)
    .filter(path => {
      return (
        path.node.property.type === 'Identifier' &&
        (path.node.property.name === 'toDataStream' ||
          path.node.property.name === 'mergeIntoDataStream') &&
        // Ensure this is not a method call (CallExpression already handled above)
        path.parent.node.type !== 'CallExpression'
      );
    })
    .forEach(path => {
      if (path.node.property.type === 'Identifier') {
        if (path.node.property.name === 'toDataStream') {
          path.node.property.name = 'toUIMessageStream';
          context.hasChanges = true;
        } else if (path.node.property.name === 'mergeIntoDataStream') {
          path.node.property.name = 'mergeIntoUIMessageStream';
          context.hasChanges = true;
        }
      }
    });
});
