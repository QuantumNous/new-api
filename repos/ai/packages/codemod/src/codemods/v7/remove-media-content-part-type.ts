import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ObjectExpression).forEach(path => {
    const typeProperty = path.node.properties.find(property => {
      return (
        (property.type === 'Property' || property.type === 'ObjectProperty') &&
        property.key.type === 'Identifier' &&
        property.key.name === 'type' &&
        (property.value.type === 'Literal' ||
          property.value.type === 'StringLiteral') &&
        property.value.value === 'media'
      );
    });

    if (
      typeProperty &&
      (typeProperty.type === 'Property' ||
        typeProperty.type === 'ObjectProperty') &&
      (typeProperty.value.type === 'Literal' ||
        typeProperty.value.type === 'StringLiteral')
    ) {
      typeProperty.value.value = 'file-data';
      context.hasChanges = true;
    }
  });
});
