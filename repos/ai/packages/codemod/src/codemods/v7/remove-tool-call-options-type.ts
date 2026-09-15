import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ImportDeclaration).forEach(path => {
    if (path.node.source.value !== 'ai') return;

    path.node.specifiers?.forEach(specifier => {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'ToolCallOptions'
      ) {
        specifier.imported.name = 'ToolExecutionOptions';
        if (!specifier.local || specifier.local.name === 'ToolCallOptions') {
          specifier.local = null;
        }
        context.hasChanges = true;
      }
    });
  });

  root.find(j.Identifier, { name: 'ToolCallOptions' }).forEach(path => {
    if (path.parent?.node.type === 'ImportSpecifier') return;

    path.node.name = 'ToolExecutionOptions';
    context.hasChanges = true;
  });
});
