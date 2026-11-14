import { createTransformer } from '../lib/create-transformer';

const mockRenames: Record<string, string> = {
  MockEmbeddingModelV2: 'MockEmbeddingModelV3',
  MockImageModelV2: 'MockImageModelV3',
  MockLanguageModelV2: 'MockLanguageModelV3',
  MockProviderV2: 'MockProviderV3',
  MockSpeechModelV2: 'MockSpeechModelV3',
  MockTranscriptionModelV2: 'MockTranscriptionModelV3',
};

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace import specifiers from 'ai/test' package
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      return (
        path.node.source.type === 'StringLiteral' &&
        path.node.source.value === 'ai/test'
      );
    })
    .forEach(path => {
      path.node.specifiers?.forEach(specifier => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          Object.keys(mockRenames).includes(specifier.imported.name)
        ) {
          const oldName = specifier.imported.name;
          const newName = mockRenames[oldName];
          specifier.imported.name = newName;
          // Also update the local name if it matches the original imported name
          if (
            specifier.local &&
            specifier.local.type === 'Identifier' &&
            specifier.local.name === oldName
          ) {
            specifier.local.name = newName;
          }
          context.hasChanges = true;
        }
      });
    });

  // Replace identifiers (variable names, function arguments, etc.)
  root
    .find(j.Identifier)
    .filter(path => {
      const parent = path.parent;
      return (
        Object.keys(mockRenames).includes(path.node.name) &&
        parent.node.type !== 'ImportSpecifier' &&
        !(
          parent.node.type === 'MemberExpression' &&
          parent.node.property === path.node
        ) &&
        !(parent.node.type === 'Property' && parent.node.key === path.node) &&
        !(
          parent.node.type === 'ObjectProperty' && parent.node.key === path.node
        )
      );
    })
    .forEach(path => {
      const oldName = path.node.name;
      const newName = mockRenames[oldName];
      if (newName) {
        path.node.name = newName;
        context.hasChanges = true;
      }
    });

  // Replace TypeScript type references
  root
    .find(j.TSTypeReference)
    .filter(path => {
      return (
        path.node.typeName.type === 'Identifier' &&
        Object.keys(mockRenames).includes(path.node.typeName.name)
      );
    })
    .forEach(path => {
      if (path.node.typeName.type === 'Identifier') {
        const oldName = path.node.typeName.name;
        const newName = mockRenames[oldName];
        if (newName) {
          path.node.typeName.name = newName;
          context.hasChanges = true;
        }
      }
    });
});
