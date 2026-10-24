import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  let hasChanges = false;

  // AI methods that accept providerOptions
  const aiMethods = [
    'embed',
    'embedMany',
    'generateText',
    'generateObject',
    'streamObject',
    'streamText',
    'generateSpeech',
    'transcribe',
    'streamUI',
    'render',
  ];

  // Find AI method calls and rename experimental_providerMetadata to providerOptions
  root.find(j.CallExpression).forEach(path => {
    const { callee, arguments: args } = path.node;

    // Check if this is an AI method call
    if (
      callee.type === 'Identifier' &&
      aiMethods.includes(callee.name) &&
      args.length > 0
    ) {
      const firstArg = args[0];

      // The first argument should be an object with properties
      if (firstArg.type === 'ObjectExpression') {
        firstArg.properties.forEach(prop => {
          const isPropertyType =
            prop.type === 'Property' || prop.type === 'ObjectProperty';

          if (isPropertyType && prop.key && prop.key.type === 'Identifier') {
            if (prop.key.name === 'experimental_providerMetadata') {
              prop.key.name = 'providerOptions';
              hasChanges = true;
            }
          }
        });
      }
    }
  });

  if (hasChanges) {
    context.hasChanges = true;
  }
});
