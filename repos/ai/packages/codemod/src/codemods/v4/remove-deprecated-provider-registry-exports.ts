import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace imports
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      const newSpecifiers = path.node.specifiers
        ?.map(spec => {
          if (spec.type !== 'ImportSpecifier') return spec;

          const oldName = spec.imported.name;
          if (oldName === 'experimental_createModelRegistry') {
            context.hasChanges = true;
            return j.importSpecifier(
              j.identifier('experimental_createProviderRegistry'),
            );
          }

          if (
            [
              'experimental_Provider',
              'experimental_ProviderRegistry',
              'experimental_ModelRegistry',
            ].includes(oldName)
          ) {
            context.hasChanges = true;
            return j.importSpecifier(j.identifier('Provider'));
          }

          return spec;
        })
        .filter((spec, index, arr) => {
          // Deduplicate specifiers
          if (!spec) return false;
          return (
            arr.findIndex(
              s =>
                s?.type === 'ImportSpecifier' &&
                spec.type === 'ImportSpecifier' &&
                s.imported.name === spec.imported.name,
            ) === index
          );
        });

      path.node.specifiers = newSpecifiers;
    });

  // Replace type references
  root
    .find(j.TSTypeReference)
    .filter(
      path =>
        path.node.typeName.type === 'Identifier' &&
        [
          'experimental_Provider',
          'experimental_ProviderRegistry',
          'experimental_ModelRegistry',
        ].includes(path.node.typeName.name),
    )
    .forEach(path => {
      context.hasChanges = true;
      path.node.typeName = j.identifier('Provider');
    });

  // Replace function calls
  root
    .find(j.CallExpression, {
      callee: {
        type: 'Identifier',
        name: 'experimental_createModelRegistry',
      },
    })
    .forEach(path => {
      context.hasChanges = true;
      path.node.callee = j.identifier('experimental_createProviderRegistry');
    });
});
