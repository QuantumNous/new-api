import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ObjectExpression).forEach(path => {
    path.node.properties.forEach(property => {
      if (
        (property.type === 'Property' ||
          property.type === 'ObjectProperty' ||
          property.type === 'ObjectMethod') &&
        property.key.type === 'Identifier' &&
        property.key.name === 'onEmbedFinish'
      ) {
        property.key.name = 'onEmbedEnd';
        context.hasChanges = true;
      }
    });
  });

  root.find(j.StringLiteral, { value: 'onEmbedFinish' }).forEach(path => {
    path.node.value = 'onEmbedEnd';
    context.hasChanges = true;
  });
});
