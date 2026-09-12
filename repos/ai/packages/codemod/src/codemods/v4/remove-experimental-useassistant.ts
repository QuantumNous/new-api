import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find and replace import specifiers
  root
    .find(j.ImportSpecifier)
    .filter(path => path.node.imported.name === 'experimental_useAssistant')
    .forEach(path => {
      context.hasChanges = true;
      j(path).replaceWith(j.importSpecifier(j.identifier('useAssistant')));
    });

  // Find and replace usage in the code
  root
    .find(j.Identifier)
    .filter(path => path.node.name === 'experimental_useAssistant')
    .forEach(path => {
      context.hasChanges = true;
      path.node.name = 'useAssistant';
    });
});
