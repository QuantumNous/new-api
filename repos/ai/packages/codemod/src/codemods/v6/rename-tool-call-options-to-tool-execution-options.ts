import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

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
          specifier.imported.name === 'ToolCallOptions'
        ) {
          specifier.imported.name = 'ToolExecutionOptions';
          // Also update the local name if it matches the original imported name
          if (
            specifier.local &&
            specifier.local.type === 'Identifier' &&
            specifier.local.name === 'ToolCallOptions'
          ) {
            specifier.local.name = 'ToolExecutionOptions';
          }
          context.hasChanges = true;
        }
      });
    });

  // Replace identifiers (variable names, function arguments, etc.)
  root
    .find(j.Identifier)
    .filter(path => {
      const parent = path.parent;
      return (
        path.node.name === 'ToolCallOptions' &&
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
      path.node.name = 'ToolExecutionOptions';
      context.hasChanges = true;
    });

  // Replace TypeScript type references
  root
    .find(j.TSTypeReference)
    .filter(path => {
      return (
        path.node.typeName.type === 'Identifier' &&
        path.node.typeName.name === 'ToolCallOptions'
      );
    })
    .forEach(path => {
      if (path.node.typeName.type === 'Identifier') {
        path.node.typeName.name = 'ToolExecutionOptions';
        context.hasChanges = true;
      }
    });
});
