import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  let hasChanges = false;

  // Find and rename imports
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      return !!(
        path.node.source.value === '@ai-sdk/provider' &&
        path.node.specifiers &&
        path.node.specifiers.some(
          spec =>
            spec.type === 'ImportSpecifier' &&
            spec.imported.type === 'Identifier' &&
            spec.imported.name === 'LanguageModelV1ProviderMetadata',
        )
      );
    })
    .forEach(path => {
      path.node.specifiers?.forEach(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'LanguageModelV1ProviderMetadata'
        ) {
          spec.imported.name = 'SharedV2ProviderMetadata';

          // If there's an alias, we don't need to change anything else
          // If there's no alias, we also need to rename all usages in the file
          if (
            !spec.local ||
            spec.local.name === 'LanguageModelV1ProviderMetadata'
          ) {
            if (spec.local) {
              spec.local.name = 'SharedV2ProviderMetadata';
            }

            // Rename all type references in the file
            root
              .find(j.TSTypeReference)
              .filter(typePath => {
                return (
                  typePath.node.typeName.type === 'Identifier' &&
                  typePath.node.typeName.name ===
                    'LanguageModelV1ProviderMetadata'
                );
              })
              .forEach(typePath => {
                if (typePath.node.typeName.type === 'Identifier') {
                  typePath.node.typeName.name = 'SharedV2ProviderMetadata';
                }
              });

            // Also handle any generic type references or other identifier usages
            root
              .find(j.Identifier)
              .filter(idPath => {
                return (
                  idPath.node.name === 'LanguageModelV1ProviderMetadata' &&
                  // Make sure it's not part of an import we already handled
                  idPath.parent.node.type !== 'ImportSpecifier'
                );
              })
              .forEach(idPath => {
                idPath.node.name = 'SharedV2ProviderMetadata';
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
