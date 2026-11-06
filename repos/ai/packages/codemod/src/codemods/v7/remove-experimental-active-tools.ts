import { createTransformer } from '../lib/create-transformer';

function getPropertyName(node: any): string | undefined {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'Literal' || node?.type === 'StringLiteral') {
    return typeof node.value === 'string' ? node.value : undefined;
  }
  return undefined;
}

function setPropertyName(node: any, name: string) {
  if (node.type === 'Identifier') {
    node.name = name;
  } else if (node.type === 'Literal' || node.type === 'StringLiteral') {
    node.value = name;
  }
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ObjectExpression).forEach(path => {
    path.node.properties.forEach(property => {
      if (
        (property.type === 'Property' || property.type === 'ObjectProperty') &&
        getPropertyName(property.key) === 'experimental_activeTools'
      ) {
        setPropertyName(property.key, 'activeTools');
        context.hasChanges = true;
      }
    });
  });
});
