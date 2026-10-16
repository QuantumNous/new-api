import { createTransformer } from '../lib/create-transformer';
import {
  AI_SDK_CODEMOD_ERROR_PREFIX,
  insertCommentOnce,
} from '../lib/add-comment';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;
  let shouldAddStepCountIsImport = false;
  let hasStepCountIsImport = false;

  const trackedFunctions = {
    generateText: null as string | null,
    streamText: null as string | null,
    useChat: null as string | null,
  };

  function isMaxStepsProperty(prop: any): boolean {
    return (
      (j.Property.check(prop) || j.ObjectProperty.check(prop)) &&
      ((j.Identifier.check(prop.key) && prop.key.name === 'maxSteps') ||
        (j.StringLiteral.check(prop.key) && prop.key.value === 'maxSteps'))
    );
  }

  function findMaxStepsProperty(objExpr: any) {
    if (
      !objExpr ||
      objExpr.type !== 'ObjectExpression' ||
      !Array.isArray(objExpr.properties)
    ) {
      return { index: -1, property: null };
    }

    const index = objExpr.properties.findIndex(isMaxStepsProperty);
    return {
      index,
      property: index !== -1 ? objExpr.properties[index] : null,
    };
  }

  function processObjectExpression(objExpr: any, isUseChat: boolean): boolean {
    const { index, property } = findMaxStepsProperty(objExpr);

    if (index === -1) return false;

    if (isUseChat) {
      addUseChatComment(property);
      return true;
    }

    if (
      (!j.Property.check(property) && !j.ObjectProperty.check(property)) ||
      (!j.Literal.check(property.value) &&
        !j.Identifier.check(property.value) &&
        !j.BinaryExpression.check(property.value))
    ) {
      return false;
    }
    const stopWhenProp = j.property(
      'init',
      j.identifier('stopWhen'),
      j.callExpression(j.identifier('stepCountIs'), [property.value]),
    );
    objExpr.properties.splice(index, 1, stopWhenProp);
    shouldAddStepCountIsImport = true;
    context.hasChanges = true;
    return true;
  }

  function addUseChatComment(property: any) {
    const message =
      'The maxSteps parameter has been removed from useChat. You should now use server-side `stopWhen` conditions for multi-step tool execution control. https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#maxsteps-removal';
    context.messages.push(`Not Implemented ${fileInfo.path}: ${message}`);

    insertCommentOnce(property, j, `${AI_SDK_CODEMOD_ERROR_PREFIX}${message}`);
    context.hasChanges = true;
  }

  root.find(j.ImportDeclaration).forEach(path => {
    const source = path.node.source.value;
    const specifiers = path.node.specifiers || [];

    specifiers.forEach(specifier => {
      if (specifier.type !== 'ImportSpecifier') return;

      const importedName = specifier.imported.name;
      const localName = specifier.local?.name || importedName;

      if (source === 'ai') {
        if (importedName === 'generateText') {
          trackedFunctions.generateText = localName;
        } else if (importedName === 'streamText') {
          trackedFunctions.streamText = localName;
        } else if (importedName === 'stepCountIs') {
          hasStepCountIsImport = true;
        }
      } else if (source === '@ai-sdk/react' && importedName === 'useChat') {
        trackedFunctions.useChat = localName;
      }
    });
  });

  root.find(j.CallExpression).forEach(callPath => {
    const callee = callPath.node.callee;
    let fnName: string | null = null;
    if (j.Identifier.check(callee)) {
      fnName = callee.name;
    } else if (
      j.MemberExpression.check(callee) &&
      j.Identifier.check(callee.property)
    ) {
      fnName = callee.property.name;
    }
    if (!fnName) return;

    const isGenerateText = trackedFunctions.generateText === fnName;
    const isStreamText = trackedFunctions.streamText === fnName;
    const isUseChat = trackedFunctions.useChat === fnName;

    if (!isGenerateText && !isStreamText && !isUseChat) return;

    const firstArg = callPath.node.arguments[0];
    if (j.ObjectExpression.check(firstArg)) {
      processObjectExpression(firstArg, isUseChat);
      return;
    }

    // If first argument is an identifier, process the variable
    if (j.Identifier.check(firstArg)) {
      const varName = firstArg.name;
      let processed = false;

      root
        .find(j.VariableDeclarator, { id: { name: varName } })
        .forEach(varPath => {
          if (processed) return;
          if (j.ObjectExpression.check(varPath.node.init)) {
            processed = processObjectExpression(varPath.node.init, isUseChat);
          }
        });

      if (processed) return;

      root
        .find(j.AssignmentExpression, {
          left: { type: 'Identifier', name: varName },
        })
        .forEach(assignPath => {
          if (j.ObjectExpression.check(assignPath.node.right)) {
            processObjectExpression(assignPath.node.right, isUseChat);
          }
        });
    }
  });

  // Add stepCountIs to existing `ai` or create new import if needed
  if (shouldAddStepCountIsImport && !hasStepCountIsImport) {
    const aiImport = root
      .find(j.ImportDeclaration)
      .filter(path => path.node.source.value === 'ai');

    if (aiImport.size()) {
      const path = aiImport.get();
      const specifiers = path.node.specifiers;
      const alreadyImported = specifiers?.some(
        (s: any) =>
          s.type === 'ImportSpecifier' && s.imported.name === 'stepCountIs',
      );
      if (!alreadyImported) {
        specifiers.push(j.importSpecifier(j.identifier('stepCountIs')));
        path.node.specifiers = specifiers;
      }
    } else {
      // In reality, this branch is unreachable cause `ai` import should always exist
      const firstImport = root.find(j.ImportDeclaration).at(0);
      const importDecl = j.importDeclaration(
        [j.importSpecifier(j.identifier('stepCountIs'))],
        j.literal('ai'),
      );
      if (firstImport.size()) {
        firstImport.insertAfter(importDecl);
      } else {
        root.get().node.program.body.unshift(importDecl);
      }
    }
    context.hasChanges = true;
  }
});
