import type { ASTPath } from 'jscodeshift';
import { createTransformer } from '../lib/create-transformer';

/*
`steps[].reasoning` is renamed to `steps[].reasoningText`
for `{steps}` destructured from `generateText()`.
*/

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Collect names of variables that are assigned `steps` from `generateText`
  const stepsIdentifiers = new Set<string>();

  // Step 1: Find destructuring from `generateText()`
  root
    .find(j.VariableDeclarator, {
      id: { type: 'ObjectPattern' },
      init: { type: 'AwaitExpression' },
    })
    .filter(path => {
      const init = path.node.init;

      if (
        init?.type !== 'AwaitExpression' ||
        init.argument?.type !== 'CallExpression'
      ) {
        return false;
      }

      const callee = init.argument.callee;

      return callee.type === 'Identifier' && callee.name === 'generateText';
    })
    .forEach(path => {
      if (path.node.id.type !== 'ObjectPattern') return;

      path.node.id.properties.forEach(prop => {
        if (prop.type !== 'ObjectProperty') return;
        if (prop.key.type !== 'Identifier') return;

        if (prop.key.name === 'steps' && prop.value.type === 'Identifier') {
          stepsIdentifiers.add(prop.value.name); // usually 'steps'
        }
      });
    });

  if (stepsIdentifiers.size === 0) return null;

  const pathsAndStepNames: {
    path: ASTPath;
    stepName: string;
  }[] = [];

  // Step 2a: Look for `forEach` calls on `steps`
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: 'forEach',
        },
      },
    })
    .filter(path => {
      const callee = path.node.callee;

      if (callee.type !== 'MemberExpression') return false;

      return (
        callee.object.type === 'Identifier' &&
        stepsIdentifiers.has(callee.object.name)
      );
    })
    .forEach(path => {
      const arg = path.node.arguments[0];
      if (arg.type !== 'ArrowFunctionExpression') return;

      const param = arg.params[0];
      if (param.type !== 'Identifier') return;

      const stepName = param.name;
      pathsAndStepNames.push({
        path,
        stepName,
      });
    });

  // Step 2b: Look for `for...of` loops on `steps`
  root
    .find(j.ForOfStatement)
    .filter(path => {
      const right = path.node.right;
      return right.type === 'Identifier' && stepsIdentifiers.has(right.name);
    })
    .forEach(path => {
      const stepVar = path.node.left;
      let stepName = null;

      if (stepVar.type === 'VariableDeclaration') {
        const declaration = stepVar.declarations[0];
        if (declaration.type !== 'VariableDeclarator') return;

        if (declaration.id.type === 'Identifier') {
          stepName = declaration.id.name;
        }
      } else if (stepVar.type === 'Identifier') {
        stepName = stepVar.name;
      }

      if (!stepName) return;

      pathsAndStepNames.push({
        path,
        stepName,
      });
    });

  // Step 3: Rename `reasoning` to `reasoningText` in the identified paths
  pathsAndStepNames.forEach(({ path, stepName }) => {
    j(path)
      .find(j.MemberExpression, {
        object: { type: 'Identifier', name: stepName },
        property: { type: 'Identifier', name: 'reasoning' },
      })
      .forEach(memberPath => {
        if (memberPath.node.property.type !== 'Identifier') return;

        memberPath.node.property.name = 'reasoningText';
        context.hasChanges = true; // Mark that changes were made
      });
  });
});
