import { createTransformer } from '../lib/create-transformer';

function findProperty(node: any, name: string) {
  return node.properties.find((property: any) => {
    return (
      (property.type === 'Property' || property.type === 'ObjectProperty') &&
      property.key.type === 'Identifier' &&
      property.key.name === name
    );
  });
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ObjectExpression).forEach(path => {
    const typeProperty = findProperty(path.node, 'type');
    const imageProperty = findProperty(path.node, 'image');

    if (
      !typeProperty ||
      !imageProperty ||
      (typeProperty.value.type !== 'Literal' &&
        typeProperty.value.type !== 'StringLiteral') ||
      typeProperty.value.value !== 'image'
    ) {
      return;
    }

    typeProperty.value.value = 'file';
    imageProperty.key.name = 'data';

    if (!findProperty(path.node, 'mediaType')) {
      path.node.properties.push(
        j.property('init', j.identifier('mediaType'), j.literal('image')),
      );
    }

    context.hasChanges = true;
  });
});
