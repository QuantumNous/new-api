import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ObjectExpression).forEach(path => {
    path.node.properties.forEach(property => {
      if (
        (property.type === 'Property' || property.type === 'ObjectProperty') &&
        property.key.type === 'Identifier' &&
        property.key.name === 'experimental_include'
      ) {
        property.key.name = 'include';
        context.hasChanges = true;
      }
    });
  });
});
