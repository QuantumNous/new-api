import { createTransformer } from '../lib/create-transformer';

function renameGoogleGenerativeAI(name: string) {
  return name.replace(/GoogleGenerativeAI/g, 'Google');
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ImportDeclaration).forEach(path => {
    if (path.node.source.value !== '@ai-sdk/google') return;

    path.node.specifiers?.forEach(specifier => {
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.imported.type !== 'Identifier' ||
        !specifier.imported.name.includes('GoogleGenerativeAI')
      ) {
        return;
      }

      const importedName = specifier.imported.name;
      const newName = renameGoogleGenerativeAI(importedName);
      specifier.imported.name = newName;
      if (!specifier.local || specifier.local.name === importedName) {
        specifier.local = null;
      }
      context.hasChanges = true;
    });
  });

  root.find(j.Identifier).forEach(path => {
    if (!path.node.name.includes('GoogleGenerativeAI')) return;
    if (path.parent?.node.type === 'ImportSpecifier') return;

    path.node.name = renameGoogleGenerativeAI(path.node.name);
    context.hasChanges = true;
  });
});
