import { createTransformer } from '../../lib/create-transformer';
import {
  AI_SDK_CODEMOD_ERROR_PREFIX,
  insertCommentOnce,
} from '../../lib/add-comment';
import type { ASTPath } from 'jscodeshift';

function isStatementOrVarDecl(node: { type: string }) {
  return (
    typeof node.type === 'string' &&
    (node.type.endsWith('Statement') || node.type === 'VariableDeclaration')
  );
}

export default createTransformer((fileInfo, _api, _options, context) => {
  const { j, root } = context;

  function processMatch(path: ASTPath<any>, message: string) {
    context.messages.push(
      `Tool invocations migration needed in ${fileInfo.path}: ${message}`,
    );

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

    const hasChanges = insertCommentOnce(
      targetNode,
      j,
      `${AI_SDK_CODEMOD_ERROR_PREFIX}${message}`,
    );

    if (hasChanges) {
      context.hasChanges = true;
    }
  }

  // find part.toolInvocation.toolName pattern
  root
    .find(j.MemberExpression, {
      property: { type: 'Identifier', name: 'toolName' },
    })
    .forEach(path => {
      const node = path.node;
      if (
        node.object &&
        node.object.type === 'MemberExpression' &&
        node.object.property &&
        node.object.property.type === 'Identifier' &&
        node.object.property.name === 'toolInvocation'
      ) {
        processMatch(
          path,
          `The part.toolInvocation.toolName property has been removed. Tool parts now use typed naming: part.type === 'tool-\${toolName}'. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage`,
        );
      }
    });

  // find part.toolInvocation.state pattern
  root
    .find(j.MemberExpression, {
      property: { type: 'Identifier', name: 'state' },
    })
    .forEach(path => {
      const node = path.node;
      if (
        node.object &&
        node.object.type === 'MemberExpression' &&
        node.object.property &&
        node.object.property.type === 'Identifier' &&
        node.object.property.name === 'toolInvocation'
      ) {
        processMatch(
          path,
          `The part.toolInvocation.state property has been removed. Tool parts now have specific states: 'input-available', 'calling', 'output-available'. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage`,
        );
      }
    });

  // find part.type === 'tool-invocation' pattern
  root
    .find(j.BinaryExpression, {
      operator: '===',
      right: { type: 'StringLiteral', value: 'tool-invocation' },
    })
    .forEach(path => {
      const left = path.node.left;
      if (
        left.type === 'MemberExpression' &&
        left.property.type === 'Identifier' &&
        left.property.name === 'type'
      ) {
        processMatch(
          path,
          `The generic 'tool-invocation' type has been replaced with typed naming: 'tool-\${toolName}'. Update to check for specific tool types. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage`,
        );
      }
    });

  // also check for == operator
  root
    .find(j.BinaryExpression, {
      operator: '==',
      right: { type: 'StringLiteral', value: 'tool-invocation' },
    })
    .forEach(path => {
      const left = path.node.left;
      if (
        left.type === 'MemberExpression' &&
        left.property.type === 'Identifier' &&
        left.property.name === 'type'
      ) {
        processMatch(
          path,
          `The generic 'tool-invocation' type has been replaced with typed naming: 'tool-\${toolName}'. Update to check for specific tool types. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage`,
        );
      }
    });
});
