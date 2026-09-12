import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;
  const localNames = new Set<string>();

  root.find(j.ImportDeclaration).forEach(path => {
    if (path.node.source.value !== 'ai') return;

    path.node.specifiers?.forEach(specifier => {
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.imported.type !== 'Identifier' ||
        specifier.imported.name !== 'stepCountIs'
      ) {
        return;
      }

      const localName = specifier.local?.name ?? 'stepCountIs';
      specifier.imported.name = 'isStepCount';
      if (!specifier.local || specifier.local.name === 'stepCountIs') {
        specifier.local = null;
        localNames.add(localName);
      }
      context.hasChanges = true;
    });
  });

  localNames.forEach(localName => {
    root.find(j.Identifier, { name: localName }).forEach(path => {
      if (path.parent?.node.type === 'ImportSpecifier') return;
      path.node.name = 'isStepCount';
      context.hasChanges = true;
    });
  });
});
