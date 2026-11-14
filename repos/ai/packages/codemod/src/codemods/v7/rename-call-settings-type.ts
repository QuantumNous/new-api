import { createTransformer } from '../lib/create-transformer';

function ensureRequestOptionsImport(root: any, j: any) {
  let aiImport: any;
  let hasRequestOptions = false;

  root.find(j.ImportDeclaration).forEach((path: any) => {
    if (path.node.source.value !== 'ai') return;
    aiImport ??= path.node;
    hasRequestOptions ||= path.node.specifiers?.some((specifier: any) => {
      return (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'RequestOptions'
      );
    });
  });

  if (hasRequestOptions) return false;

  const requestOptionsSpecifier = j.importSpecifier(
    j.identifier('RequestOptions'),
  );
  requestOptionsSpecifier.importKind = 'type';

  if (aiImport) {
    aiImport.specifiers = [
      ...(aiImport.specifiers ?? []),
      requestOptionsSpecifier,
    ];
  } else {
    const importDeclaration = j.importDeclaration(
      [requestOptionsSpecifier],
      j.literal('ai'),
    );
    importDeclaration.importKind = 'type';
    root.get().node.program.body.unshift(importDeclaration);
  }

  return true;
}

function callSettingsReplacement(j: any) {
  return j.tsIntersectionType([
    j.tsTypeReference(j.identifier('LanguageModelCallOptions')),
    j.tsTypeReference(
      j.identifier('Omit'),
      j.tsTypeParameterInstantiation([
        j.tsTypeReference(j.identifier('RequestOptions')),
        j.tsLiteralType(j.stringLiteral('timeout')),
      ]),
    ),
  ]);
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;
  const localNames = new Set<string>();

  root.find(j.ImportDeclaration).forEach(path => {
    if (path.node.source.value !== 'ai') return;

    path.node.specifiers?.forEach(specifier => {
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.imported.type !== 'Identifier' ||
        specifier.imported.name !== 'CallSettings'
      ) {
        return;
      }

      localNames.add(specifier.local?.name ?? 'CallSettings');
      specifier.imported.name = 'LanguageModelCallOptions';
      if (!specifier.local || specifier.local.name === 'CallSettings') {
        specifier.local = null;
      }
      context.hasChanges = true;
    });
  });

  if (localNames.size === 0) return;

  if (ensureRequestOptionsImport(root, j)) {
    context.hasChanges = true;
  }

  root.find(j.TSTypeReference).forEach(path => {
    if (
      path.node.typeName.type === 'Identifier' &&
      localNames.has(path.node.typeName.name)
    ) {
      j(path).replaceWith(callSettingsReplacement(j));
      context.hasChanges = true;
    }
  });
});
