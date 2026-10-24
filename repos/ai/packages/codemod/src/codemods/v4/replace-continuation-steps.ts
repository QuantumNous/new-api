import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track imports from 'ai' package
  const targetImports = new Set<string>();

  // First pass - collect imports
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      path.node.specifiers?.forEach(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'generateText'
        ) {
          targetImports.add(spec.local?.name || spec.imported.name);
        }
      });
    });

  function isWithinGenerateTextCall(path: any): boolean {
    let current = path;
    while (current) {
      if (
        current.node.type === 'CallExpression' &&
        current.node.callee.type === 'Identifier' &&
        targetImports.has(current.node.callee.name)
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  // Replace property name only within generateText calls
  root
    .find(j.ObjectProperty)
    .filter(
      path =>
        path.node.key.type === 'Identifier' &&
        path.node.key.name === 'experimental_continuationSteps' &&
        isWithinGenerateTextCall(path),
    )
    .forEach(path => {
      if (path.node.key.type === 'Identifier') {
        context.hasChanges = true;
        path.node.key.name = 'experimental_continueSteps';
      }
    });
});
