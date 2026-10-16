import { createTransformer } from './create-transformer';

export function addAwaitFn(functionName: string) {
  return createTransformer((fileInfo, api, options, context) => {
    const { j, root } = context;

    // Find import of the specified function from 'ai'
    const functionImportNames = new Set<string>();

    root
      .find(j.ImportDeclaration)
      .filter(path => path.node.source.value === 'ai')
      .forEach(path => {
        path.node.specifiers?.forEach(specifier => {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === functionName
          ) {
            // Add local name to the set (handle aliasing)
            const localName = specifier.local?.name || specifier.imported.name;
            functionImportNames.add(localName);
          }
        });
      });

    if (functionImportNames.size > 0) {
      // Add 'await' before calls to the specified function (if not already awaited)
      root
        .find(j.CallExpression)
        .filter(path => {
          const callee = path.node.callee;
          if (callee.type === 'Identifier') {
            return functionImportNames.has(callee.name);
          }
          return false;
        })
        .filter(path => {
          // Check if already wrapped in AwaitExpression
          const parent = path.parent;
          return parent.node.type !== 'AwaitExpression';
        })
        .forEach(path => {
          context.hasChanges = true;
          j(path).replaceWith(j.awaitExpression(path.node));
        });
    }
  });
}
