import { createTransformer } from '../../lib/create-transformer';
import {
  AI_SDK_CODEMOD_ERROR_PREFIX,
  insertCommentOnce,
} from '../../lib/add-comment';
import type { ASTPath, Identifier, MemberExpression } from 'jscodeshift';

const patterns: {
  keyword: string;
  message: string;
  importedFrom?: string;
}[] = [
  {
    keyword: 'appendResponseMessages',
    message:
      'The `appendResponseMessages` option has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#message-persistence-changes',
    importedFrom: 'ai',
  },
  {
    keyword: 'appendClientMessage',
    message:
      'The `appendClientMessage` option has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#message-persistence-changes',
    importedFrom: 'ai',
  },
  {
    keyword: 'StreamData',
    message:
      'The `StreamData` type has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#stream-data-removal',
    importedFrom: 'ai',
  },
  {
    keyword: 'experimental_attachments',
    message:
      'The `experimental_attachments` property has been replaced with the parts array. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#attachments--file-parts',
  },
  {
    keyword: 'part.toolInvocation.toolName',
    message:
      'The `part.toolInvocation.toolName` property has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage',
  },
  {
    keyword: 'part.toolInvocation.state',
    message:
      'The `part.toolInvocation.state` property has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage',
  },
];

function isStatementOrVarDecl(node: { type: string }) {
  return (
    typeof node.type === 'string' &&
    (node.type.endsWith('Statement') || node.type === 'VariableDeclaration')
  );
}

function isInImportDeclaration(path: ASTPath): boolean {
  let parent = path.parent;
  while (parent) {
    if (
      parent.node.type === 'ImportDeclaration' ||
      parent.node.type === 'ImportSpecifier' ||
      parent.node.type === 'ImportDefaultSpecifier' ||
      parent.node.type === 'ImportNamespaceSpecifier'
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function getMemberExpressionChain(node: MemberExpression): string[] | null {
  const chain: string[] = [];
  let current: MemberExpression | Identifier | null = node;
  while (current && current.type === 'MemberExpression') {
    if (current.property.type === 'Identifier') {
      chain.unshift(current.property.name);
    } else {
      // only support dot notation
      return null;
    }
    current = current.object as MemberExpression | Identifier;
  }
  if (current && current.type === 'Identifier') {
    chain.unshift(current.name);
  } else {
    return null;
  }
  return chain;
}

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const importMap = new Map<string, Map<string, string>>();

  root.find(j.ImportDeclaration).forEach(path => {
    const source = path.node.source.value;
    if (typeof source !== 'string') return;

    if (!importMap.has(source)) {
      importMap.set(source, new Map());
    }
    const packageImports = importMap.get(source)!;

    path.node.specifiers?.forEach(specifier => {
      if (specifier.type === 'ImportSpecifier') {
        const importedName = specifier.imported.name;
        const localName = specifier.local?.name || importedName;
        packageImports.set(localName, importedName);
      }
    });
  });

  function isKeywordImportedFromPackage(
    keyword: string,
    packageName: string,
  ): string | null {
    const packageImports = importMap.get(packageName);
    if (!packageImports) return null;

    for (const [localName, originalName] of packageImports.entries()) {
      if (originalName === keyword) {
        return localName;
      }
    }
    return null;
  }

  function handlePatternMatch({
    keyword,
    message,
    importedFrom,
  }: {
    keyword: string;
    message: string;
    importedFrom?: string;
  }) {
    let actualKeywordToMatch = keyword;
    if (importedFrom) {
      const localName = isKeywordImportedFromPackage(keyword, importedFrom);
      if (!localName) {
        return;
      }
      actualKeywordToMatch = localName;
    }

    if (actualKeywordToMatch.includes('.')) {
      const parts = actualKeywordToMatch.split('.');
      const lastPart = parts[parts.length - 1];
      root
        .find(j.MemberExpression, {
          property: { type: 'Identifier', name: lastPart },
        })
        .forEach(path => {
          const chain = getMemberExpressionChain(path.node);
          if (!chain) return;
          if (chain.length !== parts.length) return;
          for (let i = 0; i < parts.length; i++) {
            if (chain[i] !== parts[i]) return;
          }
          if (isInImportDeclaration(path)) return;
          processMatch(path, message);
        });
    } else {
      root.find(j.Identifier, { name: actualKeywordToMatch }).forEach(path => {
        if (isInImportDeclaration(path)) return;
        processMatch(path, message);
      });
    }
  }

  function processMatch(path: any, message: string) {
    context.messages.push(`Not Implemented ${fileInfo.path}: ${message}`);
    let statementPath = path;
    while (statementPath && statementPath.parent) {
      if (isStatementOrVarDecl(statementPath.parent.node)) {
        statementPath = statementPath.parent;
        break;
      }
      statementPath = statementPath.parent;
    }
    const targetNode =
      statementPath && isStatementOrVarDecl(statementPath.node)
        ? statementPath.node
        : path.node;
    insertCommentOnce(
      targetNode,
      j,
      `${AI_SDK_CODEMOD_ERROR_PREFIX}${message}`,
    );
    context.hasChanges = true;
  }

  patterns.forEach(handlePatternMatch);
});
