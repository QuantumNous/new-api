import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const replacements = [
    ['createDataStreamResponse', 'createUIMessageStreamResponse'],
    ['createDataStream', 'createUIMessageStream'],
    ['DataStreamWriter', 'UIMessageStreamWriter'],
  ];

  replacements.forEach(([oldName, newName]) => {
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
            specifier.imported.name === oldName
          ) {
            specifier.imported.name = newName;
            context.hasChanges = true;
          }
        });
      });

    root
      .find(j.Property)
      .filter(path => {
        return !!(
          path.node.shorthand &&
          path.node.key.type === 'Identifier' &&
          path.node.key.name === oldName
        );
      })
      .forEach(path => {
        if (
          path.node.key.type === 'Identifier' &&
          path.node.value.type === 'Identifier'
        ) {
          path.node.key.name = newName;
          path.node.value.name = newName;
          context.hasChanges = true;
        }
      });

    root
      .find(j.Identifier)
      .filter(path => {
        const parent = path.parent;
        return (
          path.node.name === oldName &&
          parent.node.type !== 'ImportSpecifier' &&
          !(
            parent.node.type === 'MemberExpression' &&
            parent.node.property === path.node &&
            !parent.node.computed
          ) &&
          !(parent.node.type === 'Property' && parent.node.key === path.node) &&
          !(
            parent.node.type === 'Property' &&
            parent.node.value === path.node &&
            parent.node.shorthand
          )
        );
      })
      .forEach(path => {
        path.node.name = newName;
        context.hasChanges = true;
      });

    root
      .find(j.TSTypeReference)
      .filter(path => {
        return (
          path.node.typeName.type === 'Identifier' &&
          path.node.typeName.name === oldName
        );
      })
      .forEach(path => {
        if (path.node.typeName.type === 'Identifier') {
          path.node.typeName.name = newName;
          context.hasChanges = true;
        }
      });
  });
});
