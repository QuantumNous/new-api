import { createTransformer } from '../lib/create-transformer';

const methodRenames: Record<string, string> = {
  textEmbeddingModel: 'embeddingModel',
  textEmbedding: 'embedding',
};

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find and replace member expression calls like provider.textEmbeddingModel(...)
  root
    .find(j.CallExpression)
    .filter(path => {
      const callee = path.node.callee;
      return (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        Object.keys(methodRenames).includes(callee.property.name)
      );
    })
    .forEach(path => {
      const callee = path.node.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier'
      ) {
        const oldName = callee.property.name;
        const newName = methodRenames[oldName];
        if (newName) {
          callee.property.name = newName;
          context.hasChanges = true;
        }
      }
    });

  // Also handle member expressions without calls (e.g., const fn = provider.textEmbedding)
  root
    .find(j.MemberExpression)
    .filter(path => {
      const parent = path.parent;
      if (parent && parent.node.type === 'CallExpression') {
        return false;
      }

      return (
        path.node.property.type === 'Identifier' &&
        Object.keys(methodRenames).includes(path.node.property.name)
      );
    })
    .forEach(path => {
      if (path.node.property.type === 'Identifier') {
        const oldName = path.node.property.name;
        const newName = methodRenames[oldName];
        if (newName) {
          path.node.property.name = newName;
          context.hasChanges = true;
        }
      }
    });
});
