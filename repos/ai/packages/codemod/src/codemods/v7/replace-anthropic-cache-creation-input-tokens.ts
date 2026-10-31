import { createTransformer } from '../lib/create-transformer';

function getPropertyName(node: any): string | undefined {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'Literal' || node?.type === 'StringLiteral') {
    return typeof node.value === 'string' ? node.value : undefined;
  }
  return undefined;
}

function getBaseBeforeProviderMetadata(node: any): any | null {
  let current = node;
  while (
    current?.type === 'MemberExpression' ||
    current?.type === 'OptionalMemberExpression'
  ) {
    if (getPropertyName(current.property) === 'providerMetadata') {
      return current.object;
    }
    current = current.object;
  }
  return null;
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.Identifier, { name: 'cacheCreationInputTokens' })
    .forEach(path => {
      const memberExpression = path.parent?.node;
      if (
        memberExpression?.type !== 'MemberExpression' &&
        memberExpression?.type !== 'OptionalMemberExpression'
      ) {
        return;
      }

      if (memberExpression.property !== path.node) return;

      const base = getBaseBeforeProviderMetadata(memberExpression);
      if (!base) return;

      j(path.parent).replaceWith(
        j.memberExpression(
          j.memberExpression(
            j.memberExpression(base, j.identifier('usage')),
            j.identifier('inputTokenDetails'),
          ),
          j.identifier('cacheWriteTokens'),
        ),
      );
      context.hasChanges = true;
    });
});
