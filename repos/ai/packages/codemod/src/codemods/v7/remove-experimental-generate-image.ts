import { createTransformer } from '../lib/create-transformer';

const renames = {
  experimental_generateImage: 'generateImage',
  Experimental_GenerateImageResult: 'GenerateImageResult',
} as const;

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;
  const localRenames = new Map<string, string>();

  root.find(j.ImportDeclaration).forEach(path => {
    if (path.node.source.value !== 'ai') return;

    path.node.specifiers?.forEach(specifier => {
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.imported.type !== 'Identifier'
      ) {
        return;
      }

      const importedName = specifier.imported.name;
      const newName = renames[importedName as keyof typeof renames];
      if (!newName) return;

      const localName = specifier.local?.name ?? importedName;
      specifier.imported.name = newName;
      if (!specifier.local || specifier.local.name === importedName) {
        specifier.local = null;
        localRenames.set(localName, newName);
      }
      context.hasChanges = true;
    });
  });

  localRenames.forEach((newName, oldName) => {
    root.find(j.Identifier, { name: oldName }).forEach(path => {
      if (
        path.parent?.node.type === 'ImportSpecifier' ||
        (path.parent?.node.type === 'MemberExpression' &&
          path.parent.node.property === path.node)
      ) {
        return;
      }
      path.node.name = newName;
      context.hasChanges = true;
    });
  });
});
