import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.MemberExpression, {
      property: { type: 'Identifier', name: 'cachedInputTokens' },
    })
    .forEach(path => {
      j(path).replaceWith(
        j.memberExpression(
          j.memberExpression(
            path.node.object,
            j.identifier('inputTokenDetails'),
          ),
          j.identifier('cacheReadTokens'),
        ),
      );
      context.hasChanges = true;
    });
});
