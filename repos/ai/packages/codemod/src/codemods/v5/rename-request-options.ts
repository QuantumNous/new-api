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
            spec.imported.name === 'RequestOptions',
        )
      );
    })
    .forEach(path => {
      path.node.specifiers?.forEach(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'RequestOptions'
        ) {
          spec.imported.name = 'CompletionRequestOptions';

          // If there's no alias, we also need to rename all usages in the file
          if (!spec.local || spec.local.name === 'RequestOptions') {
            if (spec.local) {
              spec.local.name = 'CompletionRequestOptions';
            }

            // Rename all type references in the file
            root
              .find(j.TSTypeReference)
              .filter(typePath => {
                return (
                  typePath.node.typeName.type === 'Identifier' &&
                  typePath.node.typeName.name === 'RequestOptions'
                );
              })
              .forEach(typePath => {
                if (typePath.node.typeName.type === 'Identifier') {
                  typePath.node.typeName.name = 'CompletionRequestOptions';
                }
              });

            // Also handle any other identifier usages
            root
              .find(j.Identifier)
              .filter(idPath => {
                return (
                  idPath.node.name === 'RequestOptions' &&
                  // Make sure it's not part of an import we already handled
                  idPath.parent.node.type !== 'ImportSpecifier'
                );
              })
              .forEach(idPath => {
                idPath.node.name = 'CompletionRequestOptions';
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
