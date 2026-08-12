import { createTransformer } from '../lib/create-transformer';
import type {
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
} from 'jscodeshift';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Define the mapping from old names to new names
  const renameMap: Record<string, string> = {
    TokenUsage: 'LanguageModelUsage',
    CompletionTokenUsage: 'LanguageModelUsage',
    EmbeddingTokenUsage: 'EmbeddingModelUsage',
  };

  // Replace imports at ImportDeclaration level
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai')
    .forEach(path => {
      const importSpecifiers = path.node.specifiers || [];
      const newSpecifiers: (
        | ImportSpecifier
        | ImportDefaultSpecifier
        | ImportNamespaceSpecifier
      )[] = [];
      const addedNewSpecifiers = new Set<string>();

      importSpecifiers.forEach(spec => {
        if (spec.type !== 'ImportSpecifier') {
          // Retain non-ImportSpecifier specifiers (e.g., default imports, namespace imports)
          newSpecifiers.push(spec);
          return;
        }

        const oldName = spec.imported.name;
        if (!renameMap.hasOwnProperty(oldName)) {
          // Retain specifiers that are not part of the renaming
          newSpecifiers.push(spec);
          return;
        }

        const newName = renameMap[oldName];
        if (!addedNewSpecifiers.has(newName)) {
          // Add the new specifier only if it hasn't been added yet
          newSpecifiers.push(j.importSpecifier(j.identifier(newName)));
          addedNewSpecifiers.add(newName);
          context.hasChanges = true;
        }
      });

      // Replace the specifiers with the new specifiers if changes were made
      if (addedNewSpecifiers.size > 0) {
        path.node.specifiers = newSpecifiers;
      }
    });

  // Replace type references
  root
    .find(j.TSTypeReference)
    .filter(
      path =>
        path.node.typeName.type === 'Identifier' &&
        Object.keys(renameMap).includes(path.node.typeName.name),
    )
    .forEach(path => {
      if (path.node.typeName.type === 'Identifier') {
        const oldName = path.node.typeName.name;
        const newName = renameMap[oldName];
        if (newName) {
          context.hasChanges = true;
          path.node.typeName = j.identifier(newName);
        }
      }
    });
});
