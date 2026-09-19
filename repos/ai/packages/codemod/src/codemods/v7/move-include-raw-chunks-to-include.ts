import { createTransformer } from '../lib/create-transformer';

function getPropertyName(property: any): string | undefined {
  if (property.key?.type === 'Identifier') return property.key.name;
  if (
    property.key?.type === 'Literal' ||
    property.key?.type === 'StringLiteral'
  ) {
    return typeof property.key.value === 'string'
      ? property.key.value
      : undefined;
  }
  return undefined;
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ObjectExpression).forEach(path => {
    const includeRawChunks = path.node.properties.find(property => {
      return (
        (property.type === 'Property' || property.type === 'ObjectProperty') &&
        getPropertyName(property) === 'includeRawChunks'
      );
    });

    if (
      !includeRawChunks ||
      (includeRawChunks.type !== 'Property' &&
        includeRawChunks.type !== 'ObjectProperty')
    ) {
      return;
    }

    const include = path.node.properties.find(property => {
      return (
        (property.type === 'Property' || property.type === 'ObjectProperty') &&
        getPropertyName(property) === 'include'
      );
    });

    if (!include) {
      path.node.properties.push(
        j.property(
          'init',
          j.identifier('include'),
          j.objectExpression([
            j.property(
              'init',
              j.identifier('rawChunks'),
              includeRawChunks.value,
            ),
          ]),
        ),
      );
    } else if (
      (include.type === 'Property' || include.type === 'ObjectProperty') &&
      include.value.type === 'ObjectExpression'
    ) {
      include.value.properties.push(
        j.property('init', j.identifier('rawChunks'), includeRawChunks.value),
      );
    } else {
      return;
    }

    path.node.properties = path.node.properties.filter(
      property => property !== includeRawChunks,
    );
    context.hasChanges = true;
  });
});
