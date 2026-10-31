import { createTransformer } from '../lib/create-transformer';

function renameObjectPatternProperty(j: any, property: any) {
  if (
    (property.type !== 'Property' && property.type !== 'ObjectProperty') ||
    property.key.type !== 'Identifier' ||
    property.key.name !== 'experimental_context'
  ) {
    return false;
  }

  if (property.shorthand) {
    property.shorthand = false;
    property.value = j.identifier('experimental_context');
  }

  property.key.name = 'context';
  return true;
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ObjectPattern).forEach(path => {
    path.node.properties.forEach((property: any) => {
      if (renameObjectPatternProperty(j, property)) {
        context.hasChanges = true;
      }
    });
  });

  root.find(j.MemberExpression).forEach(path => {
    if (
      path.node.property.type === 'Identifier' &&
      path.node.property.name === 'experimental_context'
    ) {
      path.node.property.name = 'context';
      context.hasChanges = true;
    }
  });
});
