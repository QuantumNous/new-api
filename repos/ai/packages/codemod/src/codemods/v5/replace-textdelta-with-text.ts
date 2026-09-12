import { createTransformer } from '../lib/create-transformer';

/**
 * Codemod to replace all instances of `delta.textDelta` with `delta.text`
 * and to update destructuring patterns accordingly.
 *
 * @see https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#onchunk-callback-changes
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find member expressions that match: delta.textDelta
  root
    .find(j.MemberExpression)
    .filter(path => {
      const node = path.node;

      // Must be accessing a property called 'textDelta'
      if (
        !j.Identifier.check(node.property) ||
        node.property.name !== 'textDelta'
      ) {
        return false;
      }

      // The object must be an identifier called 'delta'
      if (!j.Identifier.check(node.object) || node.object.name !== 'delta') {
        return false;
      }

      return true;
    })
    .forEach(path => {
      // Replace delta.textDelta with delta.text
      const newMemberExpression = j.memberExpression(
        path.node.object, // delta
        j.identifier('text'), // text
      );

      path.replace(newMemberExpression);
      context.hasChanges = true;
    });

  // Find all ObjectProperty nodes in object patterns where key is 'textDelta'
  root
    .find(j.ObjectProperty)
    .filter(path => {
      const prop = path.node;

      // Must be a property with key 'textDelta'
      if (!j.Identifier.check(prop.key) || prop.key.name !== 'textDelta') {
        return false;
      }

      // Must be inside an ObjectPattern
      const parent = path.parent;
      if (!j.ObjectPattern.check(parent.node)) {
        return false;
      }

      // For variable declarations, check if destructuring from delta
      const grandParent = parent.parent;
      if (j.VariableDeclarator.check(grandParent.node)) {
        return (
          j.Identifier.check(grandParent.node.init) &&
          grandParent.node.init.name === 'delta'
        );
      }

      // For function parameters, allow transformation
      // (we can't easily check the source, so we'll transform all textDelta in function params)
      if (
        j.Function.check(grandParent.node) ||
        j.ArrowFunctionExpression.check(grandParent.node)
      ) {
        return true;
      }

      return false;
    })
    .forEach(path => {
      const prop = path.node;

      // Handle different destructuring patterns
      if (prop.shorthand) {
        // Case: { textDelta } → { text: textDelta }
        if (j.Identifier.check(prop.key)) {
          prop.key.name = 'text';
          prop.shorthand = false;
        }
      } else {
        // Case: { textDelta: customName } → { text: customName }
        if (j.Identifier.check(prop.key)) {
          prop.key.name = 'text';
        }
      }

      context.hasChanges = true;
    });
});
