import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track local names of imported IDGenerator
  const localNames = new Set<string>();

  // Find and update imports from 'ai'
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      path.node.specifiers?.forEach(specifier => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === 'IDGenerator'
        ) {
          context.hasChanges = true;

          // Track the local name (could be aliased)
          const localName = specifier.local?.name || specifier.imported.name;
          localNames.add(localName);

          // Update import name but keep the alias if it exists
          specifier.imported.name = 'IdGenerator';
          // Don't change the local name if it's aliased
        }
      });
    });

  // Find and update all references to the imported type
  root
    .find(j.Identifier)
    .filter(path => {
      return (
        localNames.has(path.node.name) &&
        // Avoid modifying the import statement itself
        path.parent.node.type !== 'ImportSpecifier'
      );
    })
    .forEach(path => {
      context.hasChanges = true;
      // Replace with the new name only if it was the original IDGenerator
      if (path.node.name === 'IDGenerator') {
        path.node.name = 'IdGenerator';
      }
    });
});
