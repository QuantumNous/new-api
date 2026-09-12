import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track if the experimental function was imported and what local name it uses
  let importedLocalName: string | null = null;

  // Find import declarations from 'ai' and rename experimental_wrapLanguageModel
  root.find(j.ImportDeclaration).forEach(importPath => {
    const node = importPath.node;

    // Check if the source is 'ai'
    if (node.source.value !== 'ai') return;

    // Check named imports and rename them
    const specifiers =
      node.specifiers?.filter(s => j.ImportSpecifier.check(s)) ?? [];

    for (const specifier of specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'experimental_wrapLanguageModel'
      ) {
        // Track the local name that's being used in the code
        importedLocalName =
          specifier.local?.name || 'experimental_wrapLanguageModel';

        // Update the import name
        specifier.imported.name = 'wrapLanguageModel';

        // If there's no alias, we also need to update the local name
        if (
          !specifier.local ||
          specifier.local.name === 'experimental_wrapLanguageModel'
        ) {
          specifier.local = j.identifier('wrapLanguageModel');
        }

        context.hasChanges = true;
      }
    }
  });

  // If we found an import, also rename all usages in the code
  if (
    importedLocalName &&
    importedLocalName === 'experimental_wrapLanguageModel'
  ) {
    root.find(j.Identifier).forEach(identifierPath => {
      const node = identifierPath.node;

      // Only rename if this identifier matches the imported name
      if (node.name === 'experimental_wrapLanguageModel') {
        // Skip if this identifier is part of an import declaration (already handled above)
        const parent = identifierPath.parent;
        if (
          parent &&
          (j.ImportSpecifier.check(parent.node) ||
            j.ImportDefaultSpecifier.check(parent.node) ||
            j.ImportNamespaceSpecifier.check(parent.node))
        ) {
          return;
        }

        // Skip if this is a property name in an object (e.g., { experimental_wrapLanguageModel: something })
        if (
          parent &&
          j.Property.check(parent.node) &&
          parent.node.key === node
        ) {
          return;
        }

        // Rename the identifier
        node.name = 'wrapLanguageModel';
        context.hasChanges = true;
      }
    });
  }
});
