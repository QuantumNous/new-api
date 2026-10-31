import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track if parseStreamPart is imported from 'ai'
  const targetImports = new Set<string>();

  // Find and update imports from 'ai'
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      path.node.specifiers?.forEach(specifier => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === 'parseStreamPart'
        ) {
          context.hasChanges = true;
          // Track local name
          targetImports.add(specifier.local?.name || specifier.imported.name);

          // Update import name
          specifier.imported.name = 'parseDataStreamPart';
          if (specifier.local) {
            specifier.local.name = 'parseDataStreamPart';
          }
        }
      });
    });

  // Update function calls only if imported from 'ai'
  root
    .find(j.CallExpression)
    .filter(
      path =>
        path.node.callee.type === 'Identifier' &&
        targetImports.has(path.node.callee.name),
    )
    .forEach(path => {
      if (path.node.callee.type === 'Identifier') {
        context.hasChanges = true;
        path.node.callee.name = 'parseDataStreamPart';
      }
    });
});
