import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.MemberExpression, {
      property: { type: 'Identifier', name: 'fullStream' },
    })
    .forEach(path => {
      path.node.property = j.identifier('stream');
      context.hasChanges = true;
    });
});
