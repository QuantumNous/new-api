import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  let hasChanges = false;

  // Find and rename imports
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      return !!(
        path.node.source.value === 'ai' &&
        path.node.specifiers &&
        path.node.specifiers.some(
          spec =>
            spec.type === 'ImportSpecifier' &&
            spec.imported.type === 'Identifier' &&
            spec.imported.name === 'DataStreamToSSETransformStream',
        )
      );
    })
    .forEach(path => {
      path.node.specifiers?.forEach(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'DataStreamToSSETransformStream'
        ) {
          spec.imported.name = 'JsonToSseTransformStream';

          // If there's no alias, we also need to rename all usages in the file
          if (
            !spec.local ||
            spec.local.name === 'DataStreamToSSETransformStream'
          ) {
            if (spec.local) {
              spec.local.name = 'JsonToSseTransformStream';
            }

            // Rename all type references in the file
            root
              .find(j.TSTypeReference)
              .filter(typePath => {
                return (
                  typePath.node.typeName.type === 'Identifier' &&
                  typePath.node.typeName.name ===
                    'DataStreamToSSETransformStream'
                );
              })
              .forEach(typePath => {
                if (typePath.node.typeName.type === 'Identifier') {
                  typePath.node.typeName.name = 'JsonToSseTransformStream';
                }
              });

            // Also handle any other identifier usages
            root
              .find(j.Identifier)
              .filter(idPath => {
                return (
                  idPath.node.name === 'DataStreamToSSETransformStream' &&
                  // Make sure it's not part of an import we already handled
                  idPath.parent.node.type !== 'ImportSpecifier'
                );
              })
              .forEach(idPath => {
                idPath.node.name = 'JsonToSseTransformStream';
              });
          }

          hasChanges = true;
        }
      });
    });

  if (hasChanges) {
    context.hasChanges = true;
  }
});
