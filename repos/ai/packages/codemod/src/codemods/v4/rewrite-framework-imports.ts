import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root.find(j.ImportDeclaration).forEach(path => {
    const sourceValue = path.node.source.value as string;
    const match = sourceValue.match(/^ai\/(svelte|vue|solid)$/);
    if (match) {
      context.hasChanges = true;
      path.node.source.value = `@ai-sdk/${match[1]}`;
    }
  });
});
