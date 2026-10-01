import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // AI methods that accept a model parameter
  const aiMethods = [
    'embed',
    'embedMany',
    'generateText',
    'generateObject',
    'streamObject',
    'streamText',
    'generateSpeech',
    'transcribe',
  ];

  // Common provider function names (these typically come from @ai-sdk/* packages)
  const providerFunctions = [
    'openai',
    'anthropic',
    'google',
    'mistral',
    'groq',
    'cohere',
    'bedrock',
    'vertex',
    'perplexity',
  ];

  const foundPatterns: Array<{
    method: string;
    provider: string;
    line: number;
    hasExistingProviderOptions: boolean;
  }> = [];

  // Find AI method calls and detect provider options patterns
  root.find(j.CallExpression).forEach(path => {
    const { callee, arguments: args } = path.node;

    // Check if this is an AI method call
    if (
      callee.type === 'Identifier' &&
      aiMethods.includes(callee.name) &&
      args.length > 0
    ) {
      const firstArg = args[0];

      // The first argument should be an object with a model property
      if (firstArg.type === 'ObjectExpression') {
        let modelProperty: any = null;
        let hasProviderOptions = false;

        // Find the model property and check for existing providerOptions
        firstArg.properties.forEach(prop => {
          const isPropertyType =
            prop.type === 'Property' || prop.type === 'ObjectProperty';

          if (isPropertyType && prop.key && prop.key.type === 'Identifier') {
            if (prop.key.name === 'model') {
              modelProperty = prop;
            } else if (prop.key.name === 'providerOptions') {
              hasProviderOptions = true;
            }
          }
        });

        if (
          modelProperty &&
          modelProperty.value &&
          modelProperty.value.type === 'CallExpression'
        ) {
          const modelCall = modelProperty.value;

          // Check if the model call is a provider function with options (second argument)
          if (
            modelCall.callee.type === 'Identifier' &&
            providerFunctions.includes(modelCall.callee.name) &&
            modelCall.arguments.length >= 2
          ) {
            const providerName = modelCall.callee.name;
            const lineNumber = path.node.loc?.start?.line || 0;

            foundPatterns.push({
              method: callee.name,
              provider: providerName,
              line: lineNumber,
              hasExistingProviderOptions: hasProviderOptions,
            });
          }
        }
      }
    }
  });

  // Generate helpful messages for found patterns
  if (foundPatterns.length > 0) {
    context.messages.push(
      `Found ${foundPatterns.length} AI method call(s) that need provider options migration:`,
    );

    foundPatterns.forEach(pattern => {
      const action = pattern.hasExistingProviderOptions
        ? `add "${pattern.provider}: { ... }" to existing providerOptions`
        : `move provider options to providerOptions: { ${pattern.provider}: { ... } }`;

      context.messages.push(
        `  Line ${pattern.line}: ${pattern.method}() - ${action}`,
      );
    });

    context.messages.push('');
    context.messages.push('Migration example:');
    context.messages.push(
      '  Before: model: openai("gpt-4o", { dimensions: 10 })',
    );
    context.messages.push('  After:  model: openai("gpt-4o"),');
    context.messages.push(
      '          providerOptions: { openai: { dimensions: 10 } }',
    );
    context.messages.push('');
    // TODO: add link to migration guide
    // context.messages.push('See migration guide: https://ai-sdk.dev/docs/migration/switch-to-provider-options');
  }
});
