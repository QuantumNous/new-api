import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track ExperimentalTool imports from 'ai' package
  const targetImports = new Set<string>();

  // First pass - collect imports from 'ai' package
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      path.node.specifiers?.forEach(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'ExperimentalTool'
        ) {
          context.hasChanges = true;
          targetImports.add(spec.local?.name || spec.imported.name);
          spec.imported.name = 'CoreTool';
          if (spec.local) {
            spec.local.name = 'CoreTool';
          }
        }
      });
    });

  // Only replace type references from 'ai' package
  root
    .find(j.TSTypeReference)
    .filter(
      path =>
        path.node.typeName.type === 'Identifier' &&
        targetImports.has(path.node.typeName.name),
    )
    .forEach(path => {
      if (path.node.typeName.type === 'Identifier') {
        context.hasChanges = true;
        path.node.typeName.name = 'CoreTool';
      }
    });
});
