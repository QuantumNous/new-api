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
          specifier.imported.name === 'CoreMessage'
        ) {
          specifier.imported.name = 'ModelMessage';
          context.hasChanges = true;
        }
      });
    });

  // Replace type references and identifiers
  root
    .find(j.Identifier)
    .filter(path => {
      // Only replace identifiers that are not part of import declarations
      // (those are handled above) and are not property keys
      const parent = path.parent;
      return (
        path.node.name === 'CoreMessage' &&
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
      path.node.name = 'ModelMessage';
      context.hasChanges = true;
    });

  // Replace TypeScript type annotations
  root
    .find(j.TSTypeReference)
    .filter(path => {
      return (
        path.node.typeName.type === 'Identifier' &&
        path.node.typeName.name === 'CoreMessage'
      );
    })
    .forEach(path => {
      if (path.node.typeName.type === 'Identifier') {
        path.node.typeName.name = 'ModelMessage';
        context.hasChanges = true;
      }
    });
});
