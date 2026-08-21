import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find toAIStream method calls and transform onCompletion to onFinal
  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.node;

    // Check if this is a toAIStream method call
    if (
      callee.type === 'MemberExpression' &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'toAIStream'
    ) {
      // Check if there's an object argument
      const args = path.node.arguments;
      if (args.length > 0 && args[0].type === 'ObjectExpression') {
        const objectArg = args[0];

        // Look for onCompletion property and rename it to onFinal
        objectArg.properties.forEach(prop => {
          if (
            (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'onCompletion'
          ) {
            context.hasChanges = true;
            prop.key.name = 'onFinal';
          } else if (
            prop.type === 'ObjectMethod' &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'onCompletion'
          ) {
            context.hasChanges = true;
            prop.key.name = 'onFinal';
          }
        });
      }
    }
  });
});
