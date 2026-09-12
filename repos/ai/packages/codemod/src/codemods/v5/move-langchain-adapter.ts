import { createTransformer } from '../lib/create-transformer';

export default createTransformer(
  (fileInfo: any, api: any, options: any, context: any) => {
    const { j, root } = context;
    // Track all local names for LangChainAdapter and their new names
    const renamedLocals: { old: string; new: string }[] = [];

    // Transform import declarations
    root
      .find(j.ImportDeclaration, { source: { value: 'ai' } })
      .forEach((path: any) => {
        const specifiers = path.node.specifiers;
        specifiers.forEach((specifier: any) => {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === 'toDataStreamResponse'
          ) {
            // Already migrated
            return;
          }
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === 'LangChainAdapter'
          ) {
            const oldLocal = specifier.local.name;
            let newLocal = oldLocal;
            specifier.imported.name = 'toDataStreamResponse';
            if (oldLocal === 'LangChainAdapter') {
              specifier.local.name = 'toDataStreamResponse';
              newLocal = 'toDataStreamResponse';
            }
            renamedLocals.push({ old: oldLocal, new: newLocal });
            context.hasChanges = true;
          }
        });
        path.node.source.value = '@ai-sdk/langchain';
        context.messages.push(
          "Updated import of LangChainAdapter from 'ai' to '@ai-sdk/langchain' and renamed to toDataStreamResponse",
        );
      });

    // Transform X.toDataStreamResponse(...) to X(...)
    renamedLocals.forEach(({ old: localName, new: newName }) => {
      root
        .find(j.CallExpression, {
          callee: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: localName },
            property: { type: 'Identifier', name: 'toDataStreamResponse' },
          },
        })
        .forEach((path: any) => {
          path.node.callee = j.identifier(localName);
          context.hasChanges = true;
          context.messages.push(
            `Replaced ${localName}.toDataStreamResponse(...) with ${localName}(...)`,
          );
        });
      // If the local name was changed (not aliased), update all identifiers
      if (localName !== newName) {
        root.find(j.Identifier, { name: localName }).forEach((idPath: any) => {
          // Don't change import specifiers
          if (j.ImportSpecifier.check(idPath.parent.node)) return;
          idPath.node.name = newName;
          context.hasChanges = true;
        });
      }
    });
  },
);
