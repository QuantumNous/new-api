import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace method calls: result.pipeDataStreamToResponse() -> result.pipeUIMessageStreamToResponse()
  root
    .find(j.CallExpression)
    .filter(path => {
      return (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier' &&
        path.node.callee.property.name === 'pipeDataStreamToResponse'
      );
    })
    .forEach(path => {
      if (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property.type === 'Identifier'
      ) {
        path.node.callee.property.name = 'pipeUIMessageStreamToResponse';
        context.hasChanges = true;
      }
    });

  // Replace import specifiers from 'ai' package
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      return (
        path.node.source.type === 'StringLiteral' &&
        path.node.source.value === 'ai'
      );
    })
    .forEach(path => {
      path.node.specifiers?.forEach(specifier => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === 'pipeDataStreamToResponse'
        ) {
          specifier.imported.name = 'pipeUIMessageStreamToResponse';
          context.hasChanges = true;
        }
      });
    });

  // Replace standalone function references
  root
    .find(j.Identifier)
    .filter(path => {
      // Only replace identifiers that are not property names in member expressions
      const parent = path.parent;
      return (
        path.node.name === 'pipeDataStreamToResponse' &&
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
      path.node.name = 'pipeUIMessageStreamToResponse';
      context.hasChanges = true;
    });
});
