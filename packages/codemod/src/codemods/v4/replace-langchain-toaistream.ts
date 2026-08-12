import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace LangChainAdapter.toAIStream with LangChainAdapter.toDataStream
  root
    .find(j.MemberExpression, {
      object: {
        type: 'Identifier',
        name: 'LangChainAdapter',
      },
      property: {
        type: 'Identifier',
        name: 'toAIStream',
      },
    })
    .forEach(path => {
      if (path.node.property.type === 'Identifier') {
        context.hasChanges = true;
        path.node.property.name = 'toDataStream';
      }
    });
});
