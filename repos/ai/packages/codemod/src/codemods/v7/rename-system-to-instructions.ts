import { createTransformer } from '../lib/create-transformer';

function getName(node: any): string | undefined {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'Literal' || node?.type === 'StringLiteral') {
    return typeof node.value === 'string' ? node.value : undefined;
  }
  return undefined;
}

function setName(node: any, name: string) {
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
        getName(property.key) === 'system'
      ) {
        setName(property.key, 'instructions');
        context.hasChanges = true;
      }
    });
  });

  root.find(j.ObjectPattern).forEach(path => {
    path.node.properties.forEach((property: any) => {
      if (
        (property.type === 'Property' || property.type === 'ObjectProperty') &&
        getName(property.key) === 'system'
      ) {
        if (property.shorthand) {
          property.shorthand = false;
          property.value = j.identifier('system');
        }
        setName(property.key, 'instructions');
        context.hasChanges = true;
      }
    });
  });

  root.find(j.MemberExpression).forEach(path => {
    if (getName(path.node.property) === 'system') {
      setName(path.node.property, 'instructions');
      context.hasChanges = true;
    }
  });
});
