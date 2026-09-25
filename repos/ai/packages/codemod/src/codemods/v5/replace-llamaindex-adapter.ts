import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  let needsToUIMessageStreamImport = false;
  let shouldRemoveLlamaIndexAdapter = false;

  // Find LlamaIndexAdapter.toDataStreamResponse() calls and replace them
  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.node;

    // Check if this is LlamaIndexAdapter.toDataStreamResponse()
    if (
      callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'LlamaIndexAdapter' &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'toDataStreamResponse'
    ) {
      context.hasChanges = true;
      needsToUIMessageStreamImport = true;
      shouldRemoveLlamaIndexAdapter = true;

      // Replace LlamaIndexAdapter.toDataStreamResponse() with toUIMessageStream()
      path.node.callee = j.identifier('toUIMessageStream');
    }
  });

  if (needsToUIMessageStreamImport) {
    // Add import for toUIMessageStream from @ai-sdk/llamaindex
    const llamaIndexImport = j.importDeclaration(
      [j.importSpecifier(j.identifier('toUIMessageStream'))],
      j.literal('@ai-sdk/llamaindex'),
    );

    // Find the first import declaration to add the new import after it
    const firstImport = root.find(j.ImportDeclaration).at(0);
    if (firstImport.length > 0) {
      firstImport.insertAfter(llamaIndexImport);
    } else {
      // If no imports exist, add at the beginning
      root.get().node.body.unshift(llamaIndexImport);
    }
  }

  if (shouldRemoveLlamaIndexAdapter) {
    // Remove or update the 'ai' import that includes LlamaIndexAdapter
    root
      .find(j.ImportDeclaration, {
        source: { value: 'ai' },
      })
      .forEach(path => {
        const specifiers = path.node.specifiers || [];

        // Filter out LlamaIndexAdapter
        const filteredSpecifiers = specifiers.filter(
          spec =>
            !(
              spec.type === 'ImportSpecifier' &&
              spec.imported.type === 'Identifier' &&
              spec.imported.name === 'LlamaIndexAdapter'
            ),
        );

        if (filteredSpecifiers.length === 0) {
          // Remove the entire import if no other specifiers remain
          j(path).remove();
        } else if (filteredSpecifiers.length !== specifiers.length) {
          // Update the import to remove LlamaIndexAdapter
          path.node.specifiers = filteredSpecifiers;
        }
      });
  }
});
