import { createTransformer } from '../lib/create-transformer';

const ImportMappings: Record<string, string> = {
  LanguageModelV1: 'LanguageModelV2',
  LanguageModelV2: 'LanguageModelV2',
  LanguageModelV1Middleware: 'LanguageModelV2Middleware',
  LanguageModelV2Middleware: 'LanguageModelV2Middleware',
};

/**
 * Codemod to update imports of LanguageModelV2 and related types from 'ai' to '@ai-sdk/provider'.
 * @see https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#language-model-v2-import
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find all import declarations from 'ai'
  root.find(j.ImportDeclaration).forEach(importPath => {
    const node = importPath.node;

    // Check if the source value is exactly 'ai'
    if (node.source.value !== 'ai') return;

    // Find specifiers that should be moved to '@ai-sdk/provider'
    const targetSpecifiers =
      node.specifiers?.filter(
        s =>
          j.ImportSpecifier.check(s) &&
          Object.keys(ImportMappings).includes(s.imported.name),
      ) ?? [];

    // If no target specifiers found, skip this import
    if (targetSpecifiers.length === 0) return;

    // Get remaining specifiers that should stay in 'ai'
    const remainingSpecifiers =
      node.specifiers?.filter(s => !targetSpecifiers.includes(s)) ?? [];

    // Rename LanguageModelV1 to LanguageModelV2 in target specifiers
    for (const specifier of targetSpecifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        ImportMappings[specifier.imported.name]
      ) {
        specifier.imported.name = ImportMappings[specifier.imported.name];
      }
    }

    // Set hasChanges to true since we will modify the AST
    context.hasChanges = true;

    if (remainingSpecifiers.length === 0) {
      // All specifiers should be moved, just change the source
      node.source.value = '@ai-sdk/provider';
      context.messages.push(`Updated import from 'ai' to '@ai-sdk/provider'`);
    } else {
      // Mixed imports: need to split them
      // The current import (with comments) should become the moved import
      // and we need to create a new import for the remaining specifiers

      // Change the current import to use the new source and target specifiers
      node.source.value = '@ai-sdk/provider';
      node.specifiers = targetSpecifiers;

      // Create new import for remaining specifiers after the current one
      const remainingImport = j.importDeclaration(
        remainingSpecifiers,
        j.literal('ai'),
      );

      // Insert the remaining import after the current one
      importPath.insertAfter(remainingImport);

      context.messages.push(
        `Split import: moved some imports from 'ai' to '@ai-sdk/provider'`,
      );
    }
  });
});
