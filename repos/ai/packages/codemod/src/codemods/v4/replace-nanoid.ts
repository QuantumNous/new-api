import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find and replace import specifiers from 'ai'
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      j(path)
        .find(j.ImportSpecifier)
        .filter(specifierPath => specifierPath.node.imported.name === 'nanoid')
        .forEach(specifierPath => {
          context.hasChanges = true;
          specifierPath.replace(j.importSpecifier(j.identifier('generateId')));
        });
    });

  // If we found changes, also replace object properties in the code
  if (context.hasChanges) {
    root
      .find(j.ObjectProperty, {
        key: { name: 'generateId' },
        value: { name: 'nanoid' },
      })
      .forEach(path => {
        const newProperty = j.objectProperty(
          j.identifier('generateId'),
          j.identifier('generateId'),
        );
        newProperty.shorthand = true;
        path.replace(newProperty);
      });
  }
});
