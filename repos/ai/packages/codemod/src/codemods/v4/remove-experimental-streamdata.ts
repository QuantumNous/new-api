import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track imports from 'ai' package only
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
          spec.imported.name === 'experimental_StreamData'
        ) {
          context.hasChanges = true;
          // Track local name
          targetImports.add(spec.local?.name || 'experimental_StreamData');
        }
      });
    });

  // Second pass - replace imports from 'ai' package only
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      const newSpecifiers = path.node.specifiers?.map(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'experimental_StreamData'
        ) {
          context.hasChanges = true;
          return j.importSpecifier(
            j.identifier('StreamData'),
            spec.local?.name === 'experimental_StreamData' ? null : spec.local,
          );
        }
        return spec;
      });
      path.node.specifiers = newSpecifiers;
    });

  // Replace type/class references only for tracked imports
  root
    .find(j.Identifier)
    .filter(path => {
      // Only replace if:
      // 1. It's one of our tracked imports from 'ai'
      // 2. It's not part of an import declaration (to avoid replacing other imports)
      return (
        targetImports.has(path.node.name) &&
        !j(path).closest(j.ImportDeclaration).size()
      );
    })
    .forEach(path => {
      path.node.name = 'StreamData';
      context.hasChanges = true;
    });
});
