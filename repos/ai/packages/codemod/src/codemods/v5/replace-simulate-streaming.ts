import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track if we need to add imports
  let needsSimulateStreamingMiddleware = false;
  let needsWrapLanguageModel = false;

  // Find provider calls with simulateStreaming: true option
  root.find(j.CallExpression).forEach(path => {
    const { callee, arguments: args } = path.node;

    // Check if this looks like a provider call (function call with 1-2 arguments)
    if (callee.type === 'Identifier' && args.length >= 1 && args.length <= 2) {
      const secondArg = args[1];

      // Check if second argument is an object with simulateStreaming: true
      if (secondArg && secondArg.type === 'ObjectExpression') {
        // Find the simulateStreaming property
        const simulateStreamingProp = secondArg.properties.find(prop => {
          return (
            (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'simulateStreaming' &&
            // jscodeshift parses true/false as Literal
            // the typescript parser parses true/false as BooleanLiteral
            (prop.value.type === 'Literal' ||
              prop.value.type === 'BooleanLiteral') &&
            prop.value.value === true
          );
        });

        if (simulateStreamingProp) {
          context.hasChanges = true;
          needsSimulateStreamingMiddleware = true;
          needsWrapLanguageModel = true;

          // Remove simulateStreaming property from the options object
          const filteredProperties = secondArg.properties.filter(
            prop =>
              !(
                (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'simulateStreaming'
              ),
          );

          // Create the new wrapped model call
          let modelCall;
          if (filteredProperties.length > 0) {
            // Keep remaining properties
            modelCall = j.callExpression(callee, [
              args[0],
              j.objectExpression(filteredProperties),
            ]);
          } else {
            // No other properties, just use the first argument
            modelCall = j.callExpression(callee, [args[0]]);
          }

          // Replace with wrapLanguageModel call
          const wrappedCall = j.callExpression(
            j.identifier('wrapLanguageModel'),
            [
              j.objectExpression([
                j.property('init', j.identifier('model'), modelCall),
                j.property(
                  'init',
                  j.identifier('middleware'),
                  j.callExpression(
                    j.identifier('simulateStreamingMiddleware'),
                    [],
                  ),
                ),
              ]),
            ],
          );

          // Replace the original call
          path.replace(wrappedCall);
        }
      }
    }
  });

  // Add necessary imports to 'ai' import declaration
  if (needsSimulateStreamingMiddleware || needsWrapLanguageModel) {
    root
      .find(j.ImportDeclaration, {
        source: { value: 'ai' },
      })
      .forEach(path => {
        const existingSpecifiers = path.node.specifiers || [];
        const importNames = new Set(
          existingSpecifiers
            .filter(spec => spec.type === 'ImportSpecifier')
            .map(spec => spec.imported.name),
        );

        const newImports = [];
        if (
          needsSimulateStreamingMiddleware &&
          !importNames.has('simulateStreamingMiddleware')
        ) {
          newImports.push(
            j.importSpecifier(j.identifier('simulateStreamingMiddleware')),
          );
        }
        if (needsWrapLanguageModel && !importNames.has('wrapLanguageModel')) {
          newImports.push(j.importSpecifier(j.identifier('wrapLanguageModel')));
        }

        if (newImports.length > 0) {
          path.node.specifiers = [...existingSpecifiers, ...newImports];
        }
      });
  }
});
