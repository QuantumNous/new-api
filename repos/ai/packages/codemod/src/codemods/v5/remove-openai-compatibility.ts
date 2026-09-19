import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track which createOpenAI identifiers are imported from @ai-sdk/openai
  const createOpenAIFromOpenAI = new Set<string>();

  // Find imports from @ai-sdk/openai and track createOpenAI identifiers
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      return (
        path.node.source.type === 'StringLiteral' &&
        path.node.source.value === '@ai-sdk/openai'
      );
    })
    .forEach(path => {
      if (path.node.specifiers) {
        path.node.specifiers.forEach(specifier => {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'createOpenAI'
          ) {
            // Track the local name (could be aliased)
            const localName = specifier.local?.name || 'createOpenAI';
            createOpenAIFromOpenAI.add(localName);
          }
        });
      }
    });

  // Only process createOpenAI calls that were imported from @ai-sdk/openai
  if (createOpenAIFromOpenAI.size > 0) {
    // Find createOpenAI function calls
    root
      .find(j.CallExpression)
      .filter(path => {
        return (
          path.node.callee.type === 'Identifier' &&
          createOpenAIFromOpenAI.has(path.node.callee.name)
        );
      })
      .forEach(path => {
        const args = path.node.arguments;

        // Check if there's an object argument
        if (args.length > 0 && args[0].type === 'ObjectExpression') {
          const objectArg = args[0];

          // Filter out the compatibility property
          const filteredProperties = objectArg.properties.filter(prop => {
            if (
              (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'compatibility'
            ) {
              context.hasChanges = true;
              return false; // Remove this property
            }
            return true; // Keep other properties
          });

          // Update the properties array
          objectArg.properties = filteredProperties;
        }
      });
  }
});
